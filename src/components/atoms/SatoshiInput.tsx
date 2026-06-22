/* eslint-disable @typescript-eslint/no-use-before-define */
import { Ref, useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Keyboard } from "@capacitor/keyboard";
import { Decimal } from "decimal.js";

import { selectDeviceInfo } from "@/redux/device";
import { selectCurrencySettings } from "@/redux/preferences";

import CurrencyService from "@/kernel/bch/CurrencyService";

import { getMaxDecimals, truncateDecimals } from "@/util/currency";
import { bchToSats, MAX_SATOSHI, satsToBch } from "@/util/sats";

interface SatoshiInputProps {
  ref?: Ref<HTMLInputElement>;
  className?: string;
  satoshis?: bigint;
  onChange?: (sats: bigint) => void;
  size?: number;
  autoFocus?: boolean;
  tokenDecimals?: number;
  max?: bigint;
}

export function SatoshiInput({
  ref = null,
  className = "",
  satoshis = 0n,
  onChange = () => null,
  size = 20,
  autoFocus = false,
  tokenDecimals = undefined,
  max = MAX_SATOSHI,
}: SatoshiInputProps) {
  const {
    shouldPreferLocalCurrency,
    localCurrency,
    denomination: userDenomination,
    isStablecoinMode,
  } = useSelector(selectCurrencySettings);

  const denomination = tokenDecimals !== undefined ? "token" : userDenomination;

  const tokenScalar = tokenDecimals !== undefined ? 10 ** -tokenDecimals : 1;

  // use deviceInfo for deviceInfo.platform
  const deviceInfo = useSelector(selectDeviceInfo);

  // ----------------
  const satsToDisplayAmount = useCallback(
    (sats): string => {
      if (!sats || new Decimal(sats).equals(0)) {
        return "0";
      }

      if (isStablecoinMode && denomination !== "token") {
        return CurrencyService("USD").satsToFiat(sats);
      }

      if (denomination === "token") {
        return new Decimal(sats).mul(tokenScalar).toString();
      }

      if (shouldPreferLocalCurrency) {
        return CurrencyService(localCurrency).satsToFiat(sats);
      }

      return satsToBch(sats)[denomination].toString();
    },
    [
      shouldPreferLocalCurrency,
      localCurrency,
      denomination,
      tokenScalar,
      isStablecoinMode,
    ]
  );

  // get raw satoshi value from any currency input
  const amountToSats = (amount): bigint => {
    // stablecoin mode
    if (isStablecoinMode && denomination !== "token") {
      const satsAmount = CurrencyService("USD").fiatToSats(amount);
      return satsAmount;
    }

    // token mode
    if (denomination === "token") {
      const scaledAmount = new Decimal(amount).div(tokenScalar).toString();
      return BigInt(scaledAmount);
    }

    // fiat mode
    if (shouldPreferLocalCurrency && denomination !== "token") {
      return CurrencyService(localCurrency).fiatToSats(amount);
    }

    // bch mode
    return bchToSats(amount, denomination);
  };

  // ----------------
  // State

  const [displayValue, setDisplayValue] = useState(
    satsToDisplayAmount(satoshis)
  );

  const [didCurrencyFlip, setDidCurrencyFlip] = useState(false);

  useEffect(
    function handleDidCurerncyFlip() {
      setDidCurrencyFlip(true);
    },
    [shouldPreferLocalCurrency]
  );

  useEffect(
    function renderOnCurrencyFlip() {
      if (didCurrencyFlip) {
        setDidCurrencyFlip(false);
        setDisplayValue(satsToDisplayAmount(satoshis));
      }
    },
    [didCurrencyFlip, satoshis, satsToDisplayAmount]
  );

  // ----------------

  const currencySettings = {
    shouldPreferLocalCurrency,
    isStablecoinMode,
    denomination,
    localCurrency,
    tokenDecimals,
  };

  const maxDecimals = getMaxDecimals(currencySettings);

  // ----------------
  // Input Handling

  // fired BEFORE HTML text input is rendered, updated, or validated
  const handleKeyDown = (event) => {
    // hide keyboard when "Enter" pressed on mobile
    if (event.key === "Enter" && deviceInfo.platform !== "web") {
      Keyboard.hide();
      event.stopPropagation();
      event.preventDefault();
    }
  };

  // fired AFTER HTML text input is updated, but before it's validated
  const handleInputChangeEvent = (event) => {
    // replace everything that's not 0-9 and '.' with '.'
    const sanitizedInput = event.target.value.replace(/[^0-9.]/, ".");
    const lastChar = sanitizedInput.substring(sanitizedInput.length - 1);

    const prevInput = displayValue.toString();

    // handle all possible decimal keys (i18n)
    const DECIMAL_KEYS = [".", ","];
    const hasEndDecimal = DECIMAL_KEYS.includes(lastChar);

    let newInput = sanitizedInput;

    if (sanitizedInput === ".") {
      newInput = "0.";
    }

    if (
      !hasEndDecimal ||
      (!shouldPreferLocalCurrency &&
        !isStablecoinMode &&
        denomination === "sats")
    ) {
      newInput = truncateDecimals(newInput, maxDecimals);
    }

    // double press "." to pad rest of number with max decimal places
    if (sanitizedInput.split(".").length > 2) {
      newInput = new Decimal(prevInput).toFixed(maxDecimals);
    }

    handleInputChange(newInput);
  };

  // validates value from <input> before updating state
  const handleInputChange = (input: string): void => {
    const hasEndDecimal = input.endsWith(".");
    const sats = amountToSats(
      hasEndDecimal ? input.substring(0, input.length - 1) : input
    );

    // don't change state if attempting to set value greater than MAX_SATOSHI
    if (max > 0 && sats > max) {
      return;
    }

    // set state to zero if attempting to set value smaller than 0
    if (sats < 0) {
      handleOnChange(0n, "0");
      return;
    }

    // update state from input value if valid
    handleOnChange(sats, input);
  };

  // called after input is validated to update component state
  const handleOnChange = (sats: bigint, display: string): void => {
    setDisplayValue(display.toString());
    onChange(sats); // propagate raw sats value to parent component
  };

  return (
    <input
      type="text"
      ref={ref}
      inputMode="decimal"
      data-testid="satoshi-input"
      className={className}
      placeholder="0"
      size={size}
      value={displayValue === "0" ? "" : displayValue}
      onKeyDown={handleKeyDown}
      onChange={handleInputChangeEvent}
      autoFocus={autoFocus}
    />
  );
}

//(deviceInfo.platform === "android" && event.keyCode === 229); // android is dumb, so we cope by catching keyCode 229 and hoping for the best

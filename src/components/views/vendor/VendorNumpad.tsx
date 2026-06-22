import { useCallback, useState } from "react";
import { useSelector } from "react-redux";

import { selectCurrencySettings } from "@/redux/preferences";

import CurrencyService from "@/kernel/bch/CurrencyService";

import { getMaxDecimals } from "@/util/currency";
import { bchToSats } from "@/util/sats";

interface VendorNumpadProps {
  onChange: (satoshis: bigint) => void;
}

export default function VendorNumpad({ onChange }: VendorNumpadProps) {
  const [displayValue, setDisplayValue] = useState("0");

  const {
    shouldPreferLocalCurrency,
    localCurrency,
    denomination,
    isStablecoinMode,
  } = useSelector(selectCurrencySettings);

  const currencySettings = {
    shouldPreferLocalCurrency,
    isStablecoinMode,
    denomination,
    localCurrency,
  };

  const maxDecimals = getMaxDecimals(currencySettings);

  // Convert display amount to satoshis (adapted from SatoshiInput)
  const amountToSats = useCallback(
    (amount: number): bigint => {
      if (amount === 0) {
        return 0n;
      }

      if (isStablecoinMode) {
        return CurrencyService("USD").fiatToSats(amount);
      }

      if (shouldPreferLocalCurrency) {
        return CurrencyService(localCurrency).fiatToSats(amount);
      }

      return bchToSats(amount, denomination);
    },
    [shouldPreferLocalCurrency, localCurrency, denomination, isStablecoinMode]
  );

  const updateValue = (newDisplay: string) => {
    setDisplayValue(newDisplay);
    const numericValue = Number.parseFloat(newDisplay) || 0;
    onChange(amountToSats(numericValue));
  };

  const handleDigit = (digit: string) => {
    const decimalIndex = displayValue.indexOf(".");

    // Limit decimal places
    if (decimalIndex !== -1) {
      const currentDecimals = displayValue.length - decimalIndex - 1;
      if (currentDecimals >= maxDecimals) {
        return;
      }
    }

    const newDisplay = displayValue === "0" ? digit : `${displayValue}${digit}`;
    updateValue(newDisplay);
  };

  const handleDecimal = () => {
    if (maxDecimals === 0) {
      return; // No decimals for sats
    }
    if (!displayValue.includes(".")) {
      updateValue(`${displayValue}.`);
    }
  };

  const handleClear = () => {
    setDisplayValue("0");
    onChange(0n);
  };

  const buttonClass =
    "flex items-center justify-center text-3xl font-semibold bg-neutral-100 dark:bg-neutral-700 active:bg-neutral-200 dark:active:bg-neutral-600 rounded-lg select-none";

  return (
    <div className="grid grid-cols-3 gap-2 w-full h-full p-2">
      {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((digit) => (
        <button
          key={digit}
          type="button"
          className={buttonClass}
          onClick={() => handleDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <button type="button" className={buttonClass} onClick={handleClear}>
        C
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => handleDigit("0")}
      >
        0
      </button>
      <button type="button" className={buttonClass} onClick={handleDecimal}>
        .
      </button>
    </div>
  );
}

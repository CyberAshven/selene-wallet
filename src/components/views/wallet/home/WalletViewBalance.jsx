import { useCallback, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";
import { animated, useSpring } from "@react-spring/web";
import {
  DollarCircleOutlined,
  SettingFilled,
  StockOutlined,
  WarningFilled,
} from "@ant-design/icons";

import { selectCurrentPriceString } from "@/redux/exchangeRates";
import {
  selectBchNetwork,
  selectCurrencySettings,
  selectShouldDisplayExchangeRate,
  selectShouldHideBalance,
  setPreference,
} from "@/redux/preferences";
import {
  selectActiveWallet,
  selectActiveWalletBalance,
  selectActiveWalletHash,
  selectActiveWalletName,
  selectKeyViewedAt,
} from "@/redux/wallet";

import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";

import CurrencyFlip from "@/atoms/CurrencyFlip";
import NumberFormat from "@/atoms/NumberFormat";
import Satoshi from "@/atoms/Satoshi";

import { useCurrencyFlip } from "@/hooks/useCurrencyFlip";
import { useStablecoinBalance } from "@/hooks/useStablecoinBalance";

export default function WalletViewBalance() {
  const dispatch = useDispatch();

  const walletHash = useSelector(selectActiveWalletHash);
  const activeWalletName = useSelector(selectActiveWalletName);
  const key_viewed_at = useSelector(selectKeyViewedAt);

  const { balance } = useSelector(selectActiveWalletBalance);

  const priceString = useSelector(selectCurrentPriceString);
  const bchNetwork = useSelector(selectBchNetwork);

  const isKeyViewed = key_viewed_at !== null;

  const handleFlipCurrency = useCurrencyFlip();

  const shouldDisplayExchangeRate = useSelector(
    selectShouldDisplayExchangeRate
  );

  const { isStablecoinMode } = useSelector(selectCurrencySettings);

  const shouldHideBalance = useSelector(selectShouldHideBalance);
  const hiddenBalanceClasses = useMemo(
    () => (shouldHideBalance ? "blur-sm backdrop-opacity-60 opacity-25" : ""),
    [shouldHideBalance]
  );
  const handleHideBalance = useCallback(async () => {
    if (shouldHideBalance === true) {
      const isAuthorized = await SecurityService().authorize(
        AuthActions.RevealBalance
      );

      if (!isAuthorized) {
        return;
      }
    }

    dispatch(
      setPreference({
        key: "hideAvailableBalance",
        value: shouldHideBalance ? "false" : "true",
      })
    );
  }, [dispatch, shouldHideBalance]);

  return (
    <div className="py-2.5 text-center flex flex-col justify-center items-center">
      <div className="font-bold text-neutral-300 text-md tracking-wide">
        <Link
          to={`/settings/wallet/${walletHash}`}
          data-testid="wallet-name-link"
          className={`flex justify-center items-center ${!isKeyViewed && "text-warn"}`}
        >
          {bchNetwork === "chipnet" && "[CHIP] "}
          {bchNetwork === "testnet3" && "[TEST3] "}
          {bchNetwork === "testnet4" && "[TEST4] "}
          {activeWalletName}{" "}
          {!isKeyViewed && balance > 0 ? (
            <WarningFilled className="text-xs ml-1 text-warn" />
          ) : (
            <SettingFilled className="text-xs ml-1 text-primary-900" />
          )}
        </Link>
      </div>
      <button
        type="button"
        data-testid="balance-area"
        data-hidden={shouldHideBalance ? "true" : "false"}
        className={`cursor-pointer w-full ${hiddenBalanceClasses}`}
        onClick={shouldHideBalance ? handleHideBalance : handleFlipCurrency}
      >
        {isStablecoinMode ? <StablecoinBalance /> : <Balance />}
      </button>
      {shouldDisplayExchangeRate && (
        <div className="text-sm text-neutral-400 mt-0.5 flex justify-center items-center font-mono">
          <StockOutlined className="mr-1" />
          {priceString}
          <span className="mx-0.5 text-sm font-mono">/</span>BCH
        </div>
      )}
    </div>
  );
}

function StablecoinBalance() {
  const { walletHash } = useSelector(selectActiveWallet);
  const { shouldPreferLocalCurrency } = useSelector(selectCurrencySettings);

  const { stablecoinBalance } = useStablecoinBalance(walletHash);

  const { spendable_balance } = useSelector(selectActiveWalletBalance);

  const [balanceReceivedSpring, receiveSpringApi] = useSpring(() => ({
    from: { color: "#8dc451" },
    to: { color: "#f3f1ec" },
    immediate: true,
    config: {
      tension: 230,
      friction: 100,
      mass: 0.6,
    },
  }));

  useEffect(
    function animateWalletBalanceOnReceive() {
      receiveSpringApi.start({ reset: true });
    },
    [stablecoinBalance, receiveSpringApi]
  );

  return (
    <>
      <div className="text-2xl text-neutral-50 tabular-nums flex justify-center items-center">
        <animated.span
          className="text-center"
          style={{ ...balanceReceivedSpring }}
        >
          $<NumberFormat number={stablecoinBalance} decimals={2} scalar={-2} />
        </animated.span>
        <span className="ml-2 flex items-center">
          <DollarCircleOutlined className="text-xl" />
        </span>
      </div>
      <div className="text-md text-neutral-300 flex items-center justify-center">
        <span className="flex items-center justify-center">
          +
          <Satoshi
            value={spendable_balance}
            fiat={shouldPreferLocalCurrency && "USD"}
          />
        </span>
        {shouldPreferLocalCurrency && (
          <span className="ml-1.5 px-1.5 border border-neutral-300 text-xs text-neutral-200 rounded-full flex items-center justify-center">
            ₿
          </span>
        )}
      </div>
    </>
  );
}

function Balance() {
  const { spendable_balance } = useSelector(selectActiveWalletBalance);
  const displayBalance = spendable_balance;

  const [balanceReceivedSpring, receiveSpringApi] = useSpring(() => ({
    from: { color: "#8dc451" },
    to: { color: "#f3f1ec" },
    immediate: true,
    config: {
      tension: 230,
      friction: 100,
      mass: 0.6,
    },
  }));

  useEffect(
    function animateWalletBalanceOnReceive() {
      receiveSpringApi.start({ reset: true });
    },
    [displayBalance, receiveSpringApi]
  );

  return (
    <>
      <div className="text-2xl text-neutral-50 tabular-nums flex justify-center items-center">
        <animated.span style={{ ...balanceReceivedSpring }}>
          <Satoshi value={displayBalance} />
        </animated.span>
      </div>

      <div className="text-md text-neutral-300 flex items-center justify-center">
        <Satoshi value={displayBalance} flip />
        <CurrencyFlip className="ml-1" />
      </div>
    </>
  );
}

import { useCallback } from "react";
import { useSelector } from "react-redux";
import { Decimal } from "decimal.js";

import { selectLocale } from "@/redux/device";
import {
  selectCurrencySettings,
  selectPrivacySettings,
} from "@/redux/preferences";

import CurrencyService from "@/kernel/bch/CurrencyService";

import { satsToBch } from "@/util/sats";

interface Props {
  value?: number | bigint | string;
  fiat?: string | boolean;
  flip?: boolean;
  forceVisible?: boolean;
}

export default function Satoshi({
  value = 0,
  fiat = undefined,
  flip = false,
  forceVisible = false,
}: Props) {
  const { shouldPreferLocalCurrency, localCurrency, denomination } =
    useSelector(selectCurrencySettings);
  const { shouldHideBalance } = useSelector(selectPrivacySettings);
  const locale = useSelector(selectLocale);

  const shouldDisplayFiat =
    fiat ||
    (fiat === undefined &&
      ((shouldPreferLocalCurrency && !flip) ||
        (!shouldPreferLocalCurrency && flip)));

  const formatIndex = shouldDisplayFiat ? "fiat" : denomination;

  const formatSatoshis = useCallback(
    (amount) => {
      if (!amount && amount?.toString() !== "0") {
        return {
          bch: "-",
          sats: "-",
          fiat: "-",
        };
      }

      // Don't leak number of digits when hiding balance
      if (shouldHideBalance && !forceVisible) {
        return {
          bch: "XXXXXXXXXX",
          sats: "XXXXXXXXXX",
          fiat: "XXXXXXXXXX",
        };
      }

      const formatCurrency = typeof fiat === "string" ? fiat : localCurrency;

      const Currency = CurrencyService(formatCurrency);

      const bchSymbol = {
        bch: "₿",
        sats: "",
      };

      const bchUnit = {
        bch: "",
        sats: "Ꞩ",
      };

      const absoluteAmounts = satsToBch(
        BigInt(amount) < 0n ? BigInt(amount) * -1n : BigInt(amount)
      );

      const formattedAmounts = {
        sats: new Intl.NumberFormat(locale, {
          maximumFractionDigits: 0,
        }).format(absoluteAmounts.sats),
        bch: new Intl.NumberFormat(locale, { minimumFractionDigits: 8 }).format(
          new Decimal(absoluteAmounts.bch).toNumber()
        ),
        fiat: new Intl.NumberFormat(locale, {
          style: "currency",
          currency: formatCurrency,
        }).format(
          new Decimal(Currency.satsToFiat(absoluteAmounts.sats)).toNumber()
        ),
      };

      const sign = amount < 0 ? "-" : "";
      const bchDisplay =
        `${sign}${bchSymbol[denomination]}${formattedAmounts[denomination]} ${bchUnit[denomination]}`.trim();

      const displayAmounts = {
        bch: bchDisplay,
        sats: bchDisplay,
        fiat: `${sign}${formattedAmounts.fiat}`,
      };

      return displayAmounts;
    },
    [denomination, localCurrency, locale, shouldHideBalance, fiat, forceVisible]
  );

  return <span>{formatSatoshis(value)[formatIndex]}</span>;
}

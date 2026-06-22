import { useSelector } from "react-redux";
import { Decimal } from "decimal.js";

import { selectLocale } from "@/redux/device";

export default function NumberFormat({
  number = 0,
  decimals = undefined,
  scalar = 0,
}: {
  number?: number | bigint;
  decimals?: number;
  scalar?: number;
}) {
  const locale = useSelector(selectLocale);

  const scaledNumber = new Decimal(number).mul(10 ** scalar).toNumber();

  const numberFormat = decimals
    ? new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(scaledNumber)
    : new Intl.NumberFormat(locale).format(scaledNumber);

  return <span>{numberFormat}</span>;
}

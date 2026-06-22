import { Decimal } from "decimal.js";

export interface CurrencyInfo {
  currency: string;
  countryCode: string;
  symbol: string;
  decimals?: number;
}

export const currencyList: CurrencyInfo[] = [
  { currency: "USD", countryCode: "US", symbol: "$" },
  { currency: "BCH", countryCode: "BCH", symbol: "₿", decimals: 8 },
  { currency: "SATS", countryCode: "SATS", symbol: "Ꞩ", decimals: 0 },
  { currency: "AED", countryCode: "AE", symbol: "د.إ" },
  { currency: "ARS", countryCode: "AR", symbol: "$" },
  { currency: "AUD", countryCode: "AU", symbol: "$" },
  { currency: "BDT", countryCode: "BD", symbol: "৳" },
  { currency: "BHD", countryCode: "BH", symbol: "ب.د", decimals: 3 },
  { currency: "BMD", countryCode: "BM", symbol: "$" },
  { currency: "BRL", countryCode: "BR", symbol: "R$" },
  { currency: "CAD", countryCode: "CA", symbol: "$" },
  { currency: "CHF", countryCode: "CH", symbol: "CHF" },
  { currency: "CLP", countryCode: "CL", symbol: "$" },
  { currency: "CNY", countryCode: "CN", symbol: "¥" },
  { currency: "CZK", countryCode: "CZ", symbol: "Kč" },
  { currency: "DKK", countryCode: "DK", symbol: "kr" },
  { currency: "EUR", countryCode: "EU", symbol: "€" },
  { currency: "GBP", countryCode: "GB", symbol: "£" },
  { currency: "HKD", countryCode: "HK", symbol: "$" },
  { currency: "HUF", countryCode: "HU", symbol: "Ft" },
  { currency: "IDR", countryCode: "ID", symbol: "Rp" },
  { currency: "ILS", countryCode: "IL", symbol: "₪" },
  { currency: "INR", countryCode: "IN", symbol: "₹" },
  { currency: "JPY", countryCode: "JP", symbol: "¥" },
  { currency: "KRW", countryCode: "KR", symbol: "₩" },
  { currency: "KWD", countryCode: "KW", symbol: "ك", decimals: 3 },
  { currency: "LKR", countryCode: "LK", symbol: "රු" },
  { currency: "MMK", countryCode: "MM", symbol: "K" },
  { currency: "MXN", countryCode: "MX", symbol: "$" },
  { currency: "MYR", countryCode: "MY", symbol: "RM" },
  { currency: "NGN", countryCode: "NG", symbol: "₦" },
  { currency: "NOK", countryCode: "NO", symbol: "kr" },
  { currency: "NZD", countryCode: "NZ", symbol: "$" },
  { currency: "PHP", countryCode: "PH", symbol: "₱" },
  { currency: "PKR", countryCode: "PK", symbol: "₨" },
  { currency: "PLN", countryCode: "PL", symbol: "zł" },
  { currency: "RUB", countryCode: "RU", symbol: "₽" },
  { currency: "SAR", countryCode: "SA", symbol: "ر.س" },
  { currency: "SEK", countryCode: "SE", symbol: "kr" },
  { currency: "SGD", countryCode: "SG", symbol: "$" },
  { currency: "THB", countryCode: "TH", symbol: "฿" },
  { currency: "TRY", countryCode: "TR", symbol: "₺" },
  { currency: "TWD", countryCode: "TW", symbol: "NT$" },
  { currency: "UAH", countryCode: "UA", symbol: "₴" },
  { currency: "VES", countryCode: "VE", symbol: "Bs" },
  { currency: "VND", countryCode: "VN", symbol: "₫" },
  { currency: "ZAR", countryCode: "ZA", symbol: "R" },
];

export const DEFAULT_CURRENCY = currencyList[0];

export interface EuroZoneCountry {
  country: string;
  countryCode: string;
}

// https://european-union.europa.eu/institutions-law-budget/euro/countries-using-euro_en
export const euroZoneCountryList: EuroZoneCountry[] = [
  { country: "Austria", countryCode: "AT" },
  { country: "Belgium", countryCode: "BE" },
  { country: "Croatia", countryCode: "HR" },
  { country: "Cyprus", countryCode: "CY" },
  { country: "Estonia", countryCode: "EE" },
  { country: "Finland", countryCode: "FI" },
  { country: "France", countryCode: "FR" },
  { country: "Germany", countryCode: "DE" },
  { country: "Greece", countryCode: "GR" },
  { country: "Ireland", countryCode: "IE" },
  { country: "Italy", countryCode: "IT" },
  { country: "Latvia", countryCode: "LV" },
  { country: "Lithuania", countryCode: "LT" },
  { country: "Luxembourg", countryCode: "LU" },
  { country: "Malta", countryCode: "MT" },
  { country: "Netherlands", countryCode: "NL" },
  { country: "Portugal", countryCode: "PT" },
  { country: "Slovakia", countryCode: "SK" },
  { country: "Slovenia", countryCode: "SI" },
  { country: "Spain", countryCode: "ES" },
];

// --------------------------------
// Decimal handling utilities
// --------------------------------

export interface CurrencyInputSettings {
  shouldPreferLocalCurrency: boolean;
  isStablecoinMode: boolean;
  denomination: string;
  localCurrency?: string;
  tokenDecimals?: number;
}

/**
 * Get maximum decimal places for given currency settings
 */
export function getMaxDecimals(settings: CurrencyInputSettings): number {
  const {
    shouldPreferLocalCurrency,
    isStablecoinMode,
    denomination,
    localCurrency,
    tokenDecimals,
  } = settings;

  if (
    isStablecoinMode ||
    (shouldPreferLocalCurrency && denomination !== "token")
  ) {
    const info = currencyList.find(
      (c) => c.currency === (localCurrency || "USD")
    );
    return info?.decimals ?? 2;
  }

  switch (denomination) {
    case "token":
      return tokenDecimals || 0;
    case "sats":
      return 0;
    case "bits":
      return 2;
    case "mbch":
      return 5;
    case "bch":
    default:
      return 8;
  }
}

/**
 * Count decimal places in a numeric string
 */
export function numDecimalPlaces(num: string): number {
  const split = num.split(".");
  const minor = split.length > 1 ? split[1] : "";
  return minor.length;
}

/**
 * Truncate decimal places and round down
 */
export function truncateDecimals(value: string, maxDecimals: number): string {
  const decimals = numDecimalPlaces(value);
  const valueDecimal = new Decimal(Number.parseFloat(value) || 0);

  // limit decimal places and round down
  const amount = valueDecimal.toFixed(
    Math.min(decimals, maxDecimals),
    Decimal.ROUND_DOWN
  );

  return amount;
}

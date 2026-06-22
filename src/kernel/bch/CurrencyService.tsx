import { Device } from "@capacitor/device";
import { Decimal } from "decimal.js";

import { store } from "@/redux";
import { selectExchangeRates } from "@/redux/exchangeRates";

import LogService from "@/kernel/app/LogService";

import {
  currencyList,
  DEFAULT_CURRENCY,
  euroZoneCountryList,
} from "@/util/currency";
import { bchToSats, satsToBch } from "@/util/sats";

const Log = LogService("Currency");

// ARS (Argentina) has to be calculated from the street rate
// Rate provided by yadio.io, requested by Argentinian users, standard for Bitcoin apps
// The "official" coingecko / government ARS rate is not used on the ground
const replaceYadioRates = async (rates) => {
  const yadioApi = "https://api.yadio.io";
  const yadioRates = await fetch(`${yadioApi}/exrates/USD`, {
    method: "GET",
  });

  const yadioData = await yadioRates.json();
  const yadioUsdToArsRate = yadioData?.USD?.ARS;
  const yadioUsdToVesRate = yadioData?.USD?.VES;

  const bchToUsdRate = rates.find((r) => r.currency === "USD")?.price;

  const realBchToArsPrice = new Decimal(bchToUsdRate)
    .times(new Decimal(yadioUsdToArsRate))
    .toString();

  const realBchToVesPrice = new Decimal(bchToUsdRate)
    .times(new Decimal(yadioUsdToVesRate))
    .toString();

  // Swap in the correct ARS rate
  const adjustedRates = rates.map((r) => {
    if (r.currency === "ARS") {
      return {
        ...r,
        price: realBchToArsPrice,
      };
    }

    if (r.currency === "VES" || r.currency === "VEF") {
      return {
        ...r,
        currency: "VES",
        price: realBchToVesPrice,
      };
    }

    return r;
  });

  return adjustedRates;
};

export default function CurrencyService(
  fiatCurrency = DEFAULT_CURRENCY.currency,
  injectedRates?: Array<{ currency: string; price: string }>
) {
  return {
    fiatToSats,
    fiatToBch,
    satsToFiat,
    getExchangeRate,
    getSymbol,
    fetchExchangeRates,
    getCurrencyFromDeviceLocale,
  };

  async function fetchExchangeRates() {
    const currencies = encodeURI(
      currencyList.map((currency) => currency.currency).join(",")
    );

    // https://www.coingecko.com/en/api/documentation
    const coingeckoUri = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash&vs_currencies=${currencies}`;

    const response = await fetch(coingeckoUri, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    Log.log("Exchange rates", response);

    if (!response.ok) {
      throw new Error(response);
    }

    const json = await response.json();
    const data = json["bitcoin-cash"];

    const rates = currencyList.map((currency) => {
      if (!data[currency.currency.toLowerCase()]) {
        return { ...currency };
      }

      return {
        ...currency,
        price: data[currency.currency.toLowerCase()].toString(),
      };
    });

    // Swap in the correct ARS rate
    const adjustedRates = await replaceYadioRates(rates);

    return adjustedRates;
  }

  function fiatToSats(fiatAmount) {
    const bchAmount = new Decimal(1)
      .div(getExchangeRate(fiatCurrency))
      .times(fiatAmount);

    return bchToSats(bchAmount);
  }

  function fiatToBch(fiatAmount, denomination) {
    return satsToBch(fiatToSats(fiatAmount))[denomination];
  }

  function satsToFiat(sats) {
    return new Decimal(satsToBch(sats).bch)
      .times(getExchangeRate(fiatCurrency))
      .toFixed(getDecimals(fiatCurrency))
      .toString();
  }

  function getExchangeRate(currency, rates = undefined) {
    const exchangeRates =
      rates || injectedRates || selectExchangeRates(store.getState());
    const index = exchangeRates.findIndex(
      (exchangeRate) => exchangeRate.currency === currency
    );

    return index > -1 ? exchangeRates[index].price : 1;
  }

  function getDecimals(currency) {
    const index = currencyList.findIndex(
      (exchangeRate) => exchangeRate.currency === currency
    );

    return (index > -1 && currencyList[index].decimals) || 2;
  }

  function getSymbol(currency) {
    const index = currencyList.findIndex(
      (exchangeRate) => exchangeRate.currency === currency
    );

    return index > -1 ? currencyList[index].symbol : "";
  }

  // getCurrencyFromDeviceLocale: change default fiat currency based on device locale
  async function getCurrencyFromDeviceLocale(): Promise<string> {
    const deviceLocale = (await Device.getLanguageTag()).value.split("-")[1];

    const isEuroZoneCountry = euroZoneCountryList.find(
      (c) => c.countryCode === deviceLocale
    );

    const code = isEuroZoneCountry ? "EU" : deviceLocale;

    const { currency } =
      currencyList.find((c) => c.countryCode === code) || DEFAULT_CURRENCY;

    return currency;
  }
}

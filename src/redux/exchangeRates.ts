/* eslint-disable @typescript-eslint/no-use-before-define */
import { Preferences } from "@capacitor/preferences";
import {
  createAsyncThunk,
  createReducer,
  createSelector,
} from "@reduxjs/toolkit";
import Logger from "js-logger";

import {
  selectCurrencySettings,
  selectIsOfflineMode,
  setPreference,
} from "@/redux/preferences";

import LogService from "@/kernel/app/LogService";
import CurrencyService from "@/kernel/bch/CurrencyService";

import { currencyList } from "@/util/currency";

const Log = LogService("redux/exchangeRates");

export const fetchExchangeRates = createAsyncThunk(
  "exchangeRates/fetch",
  // eslint-disable-next-line @typescript-eslint/default-param-last
  async (attempts: number = 0, thunkApi) => {
    const storedExchangeRates = selectExchangeRates(thunkApi.getState());

    const isOfflineMode = selectIsOfflineMode(thunkApi.getState());
    if (isOfflineMode) {
      Log.debug("exchangeRates/fetch blocked by offline mode");
      return storedExchangeRates;
    }

    const { localCurrency } = selectCurrencySettings(thunkApi.getState());
    const Currency = CurrencyService(localCurrency);

    try {
      const fetchedExchangeRates = await Currency.fetchExchangeRates();

      // persist exchange rate
      // TODO #423: save exchange rates per block
      const currentPrice = Currency.getExchangeRate(
        localCurrency,
        fetchedExchangeRates
      );
      thunkApi.dispatch(
        setPreference({
          key: "lastExchangeRate",
          value: currentPrice,
        })
      );

      return fetchedExchangeRates;
    } catch (e) {
      Logger.error("fetchExchangeRates failed", e);
      setTimeout(
        () => thunkApi.dispatch(fetchExchangeRates(attempts + 1)),
        30000 * (attempts + 1)
      );
      return storedExchangeRates;
    }
  }
);

export const exchangeRateInit = createAsyncThunk(
  "exchangeRate/init",
  async () => {
    const lastExchangeRate =
      (await Preferences.get({ key: "lastExchangeRate" })).value || 1;

    const exchangeRateState = currencyList.map((currency) => ({
      ...currency,
      price: lastExchangeRate,
    }));

    Log.debug("lastExchangeRate", lastExchangeRate);
    return exchangeRateState;
  }
);

const initialState = currencyList.map((currency) => ({
  ...currency,
  price: 1,
}));

export const exchangeRateReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchExchangeRates.fulfilled, (state, action) => {
      return action.payload;
    })
    .addCase(exchangeRateInit.fulfilled, (state, action) => {
      return action.payload;
    });
});

export const selectExchangeRates = createSelector(
  (state) => state,
  (state) => state.exchangeRates
);

export function stripArsPostDecimal(localCurrency, fiatString) {
  // ARS users prefer not to see irrelevant post decimal values
  if (localCurrency === "ARS" && fiatString.includes(".")) {
    return fiatString.split(".")[0];
  }

  return fiatString;
}

export const selectCurrentPrice = createSelector(
  (state) => state,
  (state) => {
    const s = {
      exchangeRates: selectExchangeRates(state),
      currency: state.preferences.localCurrency,
      locale: state.device.locale,
    };

    const relevantCurrency = s.exchangeRates.find(
      (e) => e.currency === s.currency
    );
    const price = relevantCurrency?.price || "1";

    const priceString = `${Number(price).toLocaleString(s.locale, {
      style: "currency",
      currency: s.currency,
    })}`;

    return { price, priceString, currency: s.currency };
  }
);

export const selectCurrentPriceString = createSelector(
  (state) => selectCurrentPrice(state),
  (priceData) => priceData.priceString
);

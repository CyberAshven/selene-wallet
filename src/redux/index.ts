import { combineReducers, configureStore, isPlain } from "@reduxjs/toolkit";

import LogService from "@/kernel/app/LogService";
import BcmrService from "@/kernel/bch/BcmrService";

import { deviceInit, deviceReducer, setScannerIsScanning } from "./device";
import {
  exchangeRateInit,
  exchangeRateReducer,
  fetchExchangeRates,
} from "./exchangeRates";
import {
  preferencesInit,
  preferencesReducer,
  selectActiveWalletHash,
  selectBchNetwork,
} from "./preferences";
import { triggerCheckIn } from "./stats";
import { syncMiddleware, syncPause, syncReducer, syncResume } from "./sync";
import { txHistoryReducer } from "./txHistory";
import { addressReducer, walletBoot, walletReducer } from "./wallet";
import { walletConnectInit, walletConnectReducer } from "./walletConnect";

const Log = LogService("redux");

const rootReducer = combineReducers({
  device: deviceReducer,
  preferences: preferencesReducer,
  wallet: walletReducer,
  sync: syncReducer,
  exchangeRates: exchangeRateReducer,
  txHistory: txHistoryReducer,
  addresses: addressReducer,
  walletConnect: walletConnectReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        isSerializable: (value: unknown) =>
          typeof value === "bigint" || isPlain(value),
      },
    }).prepend(syncMiddleware.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

// initialize redux stores
export async function redux_pre_init() {
  Log.debug("redux_pre_init");
  await store.dispatch(preferencesInit());
  await store.dispatch(deviceInit());
}

// run actions needed to fire on app load
export async function redux_init() {
  Log.debug("redux_init");
  await store.dispatch(exchangeRateInit());

  await store.dispatch(
    walletBoot({
      walletHash: selectActiveWalletHash(store.getState()),
    })
  );

  const network = selectBchNetwork(store.getState());
  BcmrService(network).preloadMetadataRegistries();
}

export function redux_resume() {
  Log.debug("redux_resume");
  store.dispatch(syncResume());
  store.dispatch(walletConnectInit());
  store.dispatch(triggerCheckIn());
  store.dispatch(fetchExchangeRates(0));
}

export function redux_pause() {
  Log.debug("redux_pause");
  store.dispatch(setScannerIsScanning(false));
  store.dispatch(syncPause());
}

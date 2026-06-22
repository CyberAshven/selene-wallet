import { Preferences } from "@capacitor/preferences";
import {
  createAsyncThunk,
  createReducer,
  createSelector,
} from "@reduxjs/toolkit";

import { RootState } from "@/redux";
import { selectIsSystemDarkMode } from "@/redux/device";

import { REENCRYPTION_KEY } from "@/kernel/app/DatabaseService";
import { AuthActions } from "@/kernel/app/SecurityService";
import CurrencyService from "@/kernel/bch/CurrencyService";

import { currencyList, DEFAULT_CURRENCY } from "@/util/currency";
import { ValidBchNetwork } from "@/util/network";
import { VALID_DENOMINATIONS } from "@/util/sats";

import { languageList } from "@/util/translations";

export enum ThemeMode {
  System = "system",
  Light = "light",
  Dark = "dark",
}

export const defaultPreferences = {
  // global / wallet
  activeWalletHash: "",
  bchNetwork: "mainnet",
  languageCode: languageList[0].code,
  enableExperimental: "false",
  enablePrerelease: "false",
  lastCheckIn: "",
  lastExchangeRate: "1", // TODO #423: save exchange rates per block
  useTokenAddress: "false",
  // --------
  // Security
  authMode: "none",
  pinHash: "",
  pinInputMode: "false",
  authActions: "Any;Debug;RevealPrivateKeys;RevealBalance;SendTransaction",
  // --------
  // Currency
  localCurrency: DEFAULT_CURRENCY.currency,
  preferLocalCurrency: "true",
  denomination: "bch",
  stablecoinMode: "false", // TODO: move to wallet db
  // --------
  // Payment (move to wallet db?)
  allowInstantPay: "false",
  instantPayThreshold: "2000000", // 0.02 BCH (~$9 USD @ $450)
  instantPayThresholdFiat: "10", // $10 USD (default)
  forceTokenAddress: "false",
  useLegacyBip21: "true", // true = use legacy BIP21 format (modern PayPro not deployed yet)
  // --------
  // QR Code (move to wallet db?)
  qrCodeLogo: "Selene",
  qrCodeBackground: "#ffffff",
  qrCodeForeground: "#000000",
  // --------
  // UI
  displayExploreTab: "true",
  displayExchangeRate: "true",
  displaySyncCounter: "true",
  lastAssetsPath: "/assets/tokens",
  shouldConstrainViewport: "true",
  showMemoCard: "false",
  showOutputsCard: "true",
  themeMode: ThemeMode.System,
  // --------
  // Network
  // TODO #420: electrum peer db
  electrumServer: "",
  offlineMode: "false",
  // --------
  // Privacy
  hideAvailableBalance: "false",
  enableDailyCheckIn: "true",
  autoResolveBcmr: "true",
  // --------
  // Vendor Mode
  vendorModeActive: "false",
  vendorModeKeepAwake: "true",
  // --------
  // Encryption
  encryptionDeviceOnly: "false", // false = cloud sync enabled (default for new users)
  lastKeyBackupExport: "", // ISO timestamp of last key backup export
};

export type ValidPreferences = typeof defaultPreferences;

// validatePreferences: ensures loaded preferences object won't lead to broken app state on load
// returns true/false
export function validatePreferences(preferences: ValidPreferences): boolean {
  // lastExchangeRate must be numeric
  if (Number.isNaN(Number.parseFloat(preferences.lastExchangeRate))) {
    return false;
  }

  // languageCode must be in list of language codes
  if (!languageList.find((lang) => lang.code === preferences.languageCode)) {
    return false;
  }

  // localCurrency must be in list of currencies
  if (
    !currencyList.find(
      (currency) => currency.currency === preferences.localCurrency
    )
  ) {
    return false;
  }

  // ensure selected denomination is valid
  if (
    !VALID_DENOMINATIONS.map((d) => d.toLowerCase()).find(
      (d) => d === preferences.denomination
    )
  ) {
    return false;
  }

  // all authActions must be in AuthActions enum
  const authActions = preferences.authActions.split(";");
  if (
    authActions
      .map((a) =>
        Object.values(AuthActions)
          .map((aa) => aa.toString())
          .includes(a)
      )
      .filter((b) => b === false).length > 0
  ) {
    return false;
  }

  // force boolean strings
  const boolKeys = [
    "preferLocalCurrency",
    "hideAvailableBalance",
    "allowInstantPay",
    "enableExperimental",
    "enablePrerelease",
    "displayExchangeRate",
    "displayExploreTab",
    "displaySyncCounter",
    "shouldConstrainViewport",
    "enableDailyCheckIn",
    "offlineMode",
    "useTokenAddress",
    "autoResolveBcmr",
    "showMemoCard",
    "showOutputsCard",
    "stablecoinMode",
    "forceTokenAddress",
    "vendorModeActive",
    "vendorModeKeepAwake",
    "encryptionDeviceOnly",
    "useLegacyBip21",
    "pinInputMode",
  ];

  const invalidBools = boolKeys.filter(
    (key) => preferences[key] !== "true" && preferences[key] !== "false"
  );

  if (invalidBools.length > 0) {
    return false;
  }

  return true;
}

// Remove stale keys not in defaultPreferences, preserving REENCRYPTION_KEY
async function cleanupPreferences(): Promise<void> {
  const allKeys = (await Preferences.keys()).keys;
  const keepKeys = [...Object.keys(defaultPreferences), REENCRYPTION_KEY];
  const staleKeys = allKeys.filter((key) => !keepKeys.includes(key));
  await Promise.all(staleKeys.map((key) => Preferences.remove({ key })));
}

// Reset all preferences to defaults, preserving auth state and REENCRYPTION_KEY
async function resetToDefaults(): Promise<ValidPreferences> {
  const authMode =
    (await Preferences.get({ key: "authMode" })).value ||
    defaultPreferences.authMode;
  const pinHash =
    (await Preferences.get({ key: "pinHash" })).value ||
    defaultPreferences.pinHash;
  const defaults = await tweakDefaultPreferences();
  await Promise.all(
    Object.keys(defaults).map((key) =>
      Preferences.set({ key, value: defaults[key] })
    )
  );
  await Preferences.set({ key: "authMode", value: authMode });
  await Preferences.set({ key: "pinHash", value: pinHash });
  await cleanupPreferences();
  return defaults;
}

// tweakDefaultPreferences: dynamically change defaults for first-run/preferences reset
async function tweakDefaultPreferences() {
  const defaults = { ...defaultPreferences };

  // change default fiat currency based on device locale
  defaults.localCurrency =
    await CurrencyService().getCurrencyFromDeviceLocale();

  return defaults;
}

async function retrievePreferences(): Promise<ValidPreferences> {
  // Preferences.clear();

  // remove any unused preferences first
  await cleanupPreferences();

  const defaults = await tweakDefaultPreferences();

  const keys = Object.keys(defaults);

  const preferences = (
    await Promise.all(
      keys.map(async (key) => {
        const current = (await Preferences.get({ key })).value;
        if (current === null) {
          await Preferences.set({ key, value: defaults[key] });
          const newest = (await Preferences.get({ key })).value;
          return { [key]: newest };
        }
        return { [key]: current };
      })
    )
  ).reduce((acc, cur) => {
    return { ...acc, ...cur };
  }, {}) as ValidPreferences;

  const isValidPreferences = validatePreferences(preferences);
  if (!isValidPreferences) {
    return resetToDefaults();
  }

  return preferences;
}

const initialState = { ...defaultPreferences };

export const preferencesInit = createAsyncThunk(
  "preferences/init",
  async () => {
    const preferences = await retrievePreferences();
    return preferences;
  }
);

export const setPreference = createAsyncThunk(
  "preferences/set",
  async (payload: { key: string; value: string }) => {
    // force string value
    const fixedPayload = { ...payload, value: payload.value.toString() };
    await Preferences.set(fixedPayload);

    // ensure redux state stays consistent with device state
    const result = {
      key: payload.key,
      value: (await Preferences.get({ key: payload.key })).value,
    };

    return result;
  }
);

export const resetPreferences = createAsyncThunk(
  "preferences/reset",
  async () => {
    return resetToDefaults();
  }
);

export const preferencesReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setPreference.fulfilled, (state, action) => {
      state[action.payload.key] = action.payload.value;
    })
    .addCase(resetPreferences.fulfilled, (state, action) => {
      return action.payload;
    })
    .addCase(preferencesInit.fulfilled, (state, action) => {
      return action.payload;
    });
});

export const selectPreferences = createSelector(
  (state: RootState) => state,
  (state) => state.preferences
);

export const selectActiveWalletHash = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.activeWalletHash
);

export const selectCurrencySettings = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => ({
    localCurrency: preferences.localCurrency,
    denomination: preferences.denomination,
    shouldPreferLocalCurrency: preferences.preferLocalCurrency === "true",
    isStablecoinMode: preferences.stablecoinMode === "true",
  })
);

export const selectInstantPaySettings = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => ({
    isInstantPayEnabled: preferences.allowInstantPay === "true",
    // always in sats
    instantPayThreshold:
      preferences.preferLocalCurrency === "true"
        ? CurrencyService(preferences.localCurrency).fiatToSats(
            preferences.instantPayThresholdFiat
          )
        : preferences.instantPayThreshold,
  })
);

export const selectQrCodeSettings = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => ({
    foreground: preferences.qrCodeForeground,
    background: preferences.qrCodeBackground,
    logo: preferences.qrCodeLogo,
  })
);

export const selectLanguageCode = createSelector(
  (state: RootState) => state.preferences,
  (preferences): string => preferences.languageCode
);

export const selectElectrumServer = createSelector(
  (state: RootState) => state.preferences,
  (preferences): string => preferences.electrumServer
);

export const selectBchNetwork = createSelector(
  (state: RootState) => state.preferences,
  (preferences): ValidBchNetwork => preferences.bchNetwork
);

export const selectIsOfflineMode = createSelector(
  (state) => state.preferences,
  (preferences): boolean => preferences.offlineMode === "true"
);

export const selectSecuritySettings = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => ({
    authMode: preferences.authMode,
    authActions: preferences.authActions.split(";"),
    isNumericPin: preferences.pinInputMode === "true",
  })
);

export const selectUiSettings = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => ({
    shouldDisplayExchangeRate: preferences.displayExchangeRate === "true",
    shouldDisplayExploreTab: preferences.displayExploreTab === "true",
    shouldDisplaySyncCounter: preferences.displaySyncCounter === "true",
    shouldConstrainViewport: preferences.shouldConstrainViewport === "true",
    themeMode: preferences.themeMode as ThemeMode,
  })
);

export const selectShouldDisplayExchangeRate = createSelector(
  (state) => state.preferences,
  (preferences) => preferences.displayExchangeRate === "true"
);

export const selectShouldDisplaySyncCounter = createSelector(
  (state) => state.preferences,
  (preferences) => preferences.displaySyncCounter === "true"
);

export const selectIsDarkMode = createSelector(
  (state) => state.preferences,
  (preferences) =>
    preferences.themeMode === "dark" ||
    (preferences.themeMode === ThemeMode.System && selectIsSystemDarkMode())
);

export const selectPrivacySettings = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => ({
    shouldHideBalance: preferences.hideAvailableBalance === "true",
    isDailyCheckInEnabled: preferences.enableDailyCheckIn === "true",
    shouldResolveBcmr: preferences.autoResolveBcmr === "true",
  })
);

export const selectShouldHideBalance = createSelector(
  (state) => state.preferences,
  (preferences) => preferences.hideAvailableBalance === "true"
);

export const selectIsExperimental = createSelector(
  (state: RootState) => state.preferences,
  (preferences): boolean => preferences.enableExperimental === "true"
);

export const selectIsPrerelease = createSelector(
  (state: RootState) => state.preferences,
  (preferences): boolean =>
    preferences.enablePrerelease === "true" ||
    selectIsExperimental({ preferences })
);

export const selectLastCheckIn = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.lastCheckIn
);

export const selectShouldUseTokenAddress = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.useTokenAddress === "true"
);

export const selectShouldForceTokenAddress = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.forceTokenAddress === "true"
);

// Legacy BIP21 format (amount, ft) vs PayPro CHIP-2023-05 (s, f, n, m, e)
export const selectShouldUseLegacyBip21 = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.useLegacyBip21 === "true"
);

export const selectLastAssetsPath = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.lastAssetsPath
);

export const selectShouldConstrainViewport = createSelector(
  (state: RootState) => state,
  ({ preferences, device }) =>
    device.deviceInfo.platform === "web" &&
    preferences.shouldConstrainViewport === "true"
);

export const selectShouldShowOutputsCard = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.showOutputsCard === "true"
);

export const selectShouldShowMemoCard = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.showMemoCard === "true"
);

export const selectIsStablecoinMode = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.stablecoinMode === "true"
);

export const selectIsVendorModeActive = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.vendorModeActive === "true"
);

export const selectIsVendorModeKeepAwake = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => preferences.vendorModeKeepAwake === "true"
);

export const selectEncryptionSettings = createSelector(
  (state: RootState) => state.preferences,
  (preferences) => ({
    isDeviceOnly: preferences.encryptionDeviceOnly === "true",
    lastKeyBackupExport: preferences.lastKeyBackupExport,
  })
);

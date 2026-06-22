import { SimpleEncryption } from "capacitor-plugin-simple-encryption";

import { store } from "@/redux";
import { setIsLocked } from "@/redux/device";
import { selectSecuritySettings } from "@/redux/preferences";

import DatabaseService, {
  DecryptionFailedError,
} from "@/kernel/app/DatabaseService";
import LogService from "@/kernel/app/LogService";
import ModalService from "@/kernel/app/ModalService";
import NotificationService from "@/kernel/app/NotificationService";
import { clearSeedCache } from "@/kernel/wallet/KeyManagerService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import securityTranslations from "@/views/security/translations";

import { sha256 } from "@/util/hash";

import common from "@/translations/common";
import { translate } from "@/util/translations";

const Log = LogService("SecurityService");
const MIN_PASSWORD_LENGTH = 8;
const MIN_PIN_LENGTH = 4;

let hasPinConfigured = false;

export interface ImportKeyBackupResult {
  isSuccess: boolean;
  isKeyMismatch: boolean;
  failedFiles: string[];
}

export enum AuthActions {
  Any = "Any",
  Debug = "Debug",
  AppOpen = "AppOpen",
  AppResume = "AppResume",
  WalletActivate = "WalletActivate",
  SendTransaction = "SendTransaction",
  InstantPay = "InstantPay",
  RevealBalance = "RevealBalance",
  RevealPrivateKeys = "RevealPrivateKeys",
  VendorMode = "VendorMode",
}

const authTextKeys: Record<AuthActions, Record<string, string> | null> = {
  [AuthActions.Any]: null,
  [AuthActions.Debug]: common.debug,
  [AuthActions.AppOpen]: common.authOpenApp,
  [AuthActions.AppResume]: common.authResumeApp,
  [AuthActions.WalletActivate]: common.authActivateWallet,
  [AuthActions.SendTransaction]: common.authSendTransaction,
  [AuthActions.InstantPay]: common.authInstantPay,
  [AuthActions.RevealBalance]: common.authRevealBalances,
  [AuthActions.RevealPrivateKeys]: common.authRevealPrivateKeys,
  [AuthActions.VendorMode]: common.authVendorMode,
};

function getAuthText(action: AuthActions): string {
  const key = authTextKeys[action];
  return key ? translate(key) : "";
}

export default function SecurityService() {
  return {
    authorize,
    authorizeBio,
    authorizeLegacyPin,
    isPinConfigured,
    setPinConfigured,
    initEncryption,
    lock,
    unlock,
    securePause,
    // PIN management (state-coupled: setPinConfigured must follow)
    verifyPin,
    setPin,
    removePin,
    // Biometric (composite operations)
    hasBiometricKey,
    removeBiometricKey,
    unlockWithBiometric,
    verifyBiometric,
    storeBiometricKeyFromCurrent,
    promptBiometricPermission,
    // Composite operations
    promptForNewPin,
    changePinAndUpdateBiometric,
    exportKeyBackup,
    importKeyBackup,
    setDeviceOnlyMode,
    allWalletsSeedViewed,
    // Reset (state-coupled: must clear all auth state)
    resetEncryption,
  };

  // Initialize encryption and cache the result in module state.
  // Called from init.jsx (no pin) and from AppLockScreen (with pin).
  async function initEncryption(pin?: string): Promise<boolean> {
    const { isReady: isKeyLoaded, hasPinConfigured: hasPin } =
      await DatabaseService().initEncryption(pin);
    hasPinConfigured = hasPin;
    return isKeyLoaded;
  }

  function isPinConfigured(): boolean {
    return hasPinConfigured;
  }

  function unlock(): void {
    store.dispatch(setIsLocked(false));
  }

  function setPinConfigured(value: boolean): void {
    hasPinConfigured = value;
  }

  // Lock: flush databases, close all handles, clear native key.
  // The Redux lock flag is set first so the lock screen shows immediately.
  async function lock(): Promise<void> {
    store.dispatch(setIsLocked(true));
    clearSeedCache();
    await DatabaseService().closeAllDatabases();
    await SimpleEncryption.clearKeyFromMemory();
  }

  // Clear sensitive material without dispatching Redux state.
  // Called by AppProvider on pause — phase transition handles UI, not Redux.
  async function securePause(): Promise<void> {
    clearSeedCache();
    await DatabaseService().closeAllDatabases();
    await SimpleEncryption.clearKeyFromMemory();
  }

  // authorize user according to user preference
  async function authorize(
    action: AuthActions = AuthActions.Any
  ): Promise<boolean> {
    const { authMode, authActions } = selectSecuritySettings(store.getState());

    const isAuthRequired =
      action === AuthActions.Any || authActions.includes(action);

    if (!isAuthRequired) {
      return true;
    }

    let isAuthorized = false;
    switch (authMode) {
      case "bio":
        isAuthorized = await authorizeBio(action);
        break;

      case "pin":
      case "password":
        isAuthorized = await authorizePin(action);
        break;

      case "none":
        isAuthorized = true;
        break;

      default:
        isAuthorized = false;
        break;
    }

    if (!isAuthorized) {
      NotificationService().authFail(getAuthText(action));
    }

    return isAuthorized;
  }

  async function authorizeBio(
    action: AuthActions = AuthActions.Any
  ): Promise<boolean> {
    try {
      await verifyBiometric(getAuthText(action));
      return true;
    } catch (e) {
      Log.warn("Biometric auth failed:", e);
      return false;
    }
  }

  async function authorizePin(action: AuthActions = AuthActions.Any) {
    if (!isPinConfigured()) {
      return true;
    }

    const { isNumericPin } = selectSecuritySettings(store.getState());
    const isPasswordMode = !isNumericPin;

    const pin = await ModalService().showPrompt({
      title:
        getAuthText(action) ||
        translate(isPasswordMode ? common.enterPassword : common.enterPin),
      message: translate(
        isPasswordMode
          ? common.pleaseEnterYourPassword
          : common.pleaseEnterYourPin
      ),
      inputType: "password",
      inputMode: isPasswordMode ? "text" : "numeric",
      submitLabel: translate(common.authorizeAction),
    });

    if (!pin) {
      return false;
    }

    return verifyPin(pin);
  }

  // Remove after 99% of userbase is verified to have version 2026.03+
  async function authorizeLegacyPin(pinHash: string): Promise<string | null> {
    /* eslint-disable no-constant-condition, no-await-in-loop */
    while (true) {
      const pin = await ModalService().showPrompt({
        title: translate(securityTranslations.securityUpgrade),
        message: translate(securityTranslations.enterPinOrPasswordToUpgrade),
        inputType: "password",
        inputMode: "text",
        submitLabel: translate(securityTranslations.upgrade),
      });

      // User dismissed the modal — return to lock screen
      if (!pin) {
        return null;
      }

      if (sha256.text(pin) === pinHash) {
        return pin;
      }

      NotificationService().error(translate(common.incorrectPin));
    }
    /* eslint-enable no-constant-condition, no-await-in-loop */
  }

  // --------------------------------

  /**
   * Verify a PIN against the encryption plugin.
   * Handles lockout errors with toast notification; never throws.
   * Returns true if valid, false if invalid or locked out.
   */
  async function verifyPin(pin: string): Promise<boolean> {
    try {
      const { isValid } = await SimpleEncryption.verifyPin({ pin });
      if (!isValid) {
        NotificationService().error(translate(common.incorrectPin));
      }
      return isValid;
    } catch (e) {
      // Lockout error (native) — show remaining time
      NotificationService().error(translate(common.locked), String(e));
      return false;
    }
  }

  /** Set or change PIN. Key must already be loaded. Automatically updates pinConfigured state. */
  async function setPin(newPin: string): Promise<void> {
    await SimpleEncryption.setPin({ newPin });
    setPinConfigured(true);
  }

  /** Remove PIN. Key must already be loaded. Automatically updates pinConfigured state. */
  async function removePin(): Promise<void> {
    await SimpleEncryption.removePin();
    setPinConfigured(false);
  }

  /** Prompt user to enter and confirm a new PIN or password. Returns null if cancelled.
   *  isPasswordMode: true=text keyboard, false=numeric, undefined=read from prefs */
  async function promptForNewPin(
    isPasswordOverride?: boolean
  ): Promise<string | null> {
    const { isNumericPin } = selectSecuritySettings(store.getState());
    const isPasswordMode =
      isPasswordOverride !== undefined ? isPasswordOverride : !isNumericPin;
    const Modal = ModalService();

    const pin = await Modal.showPrompt({
      title: isPasswordMode
        ? translate(common.enterNewPassword)
        : translate(common.enterNewPin),
      message: isPasswordMode ? translate(common.minimumCharacters) : undefined,
      inputType: "password",
      inputMode: isPasswordMode ? "text" : "numeric",
      placeholder: isPasswordMode
        ? translate(common.enterPassword)
        : translate(common.enterPin),
      submitLabel: translate(common.next),
      pattern: isPasswordMode ? undefined : "[0-9]*",
    });

    if (!pin) return null;

    if (isPasswordMode && pin.length < MIN_PASSWORD_LENGTH) {
      NotificationService().error(translate(common.passwordMinLength));
      return null;
    }

    if (!isPasswordMode && pin.length < MIN_PIN_LENGTH) {
      NotificationService().error(translate(common.pinMinLength));
      return null;
    }

    const confirmPin = await Modal.showPrompt({
      title: isPasswordMode
        ? translate(common.confirmPassword)
        : translate(common.confirmPin),
      inputType: "password",
      inputMode: isPasswordMode ? "text" : "numeric",
      placeholder: isPasswordMode
        ? translate(common.enterPassword)
        : translate(common.enterPin),
      submitLabel: translate(common.confirm),
      pattern: isPasswordMode ? undefined : "[0-9]*",
    });

    if (!confirmPin) return null;

    if (pin !== confirmPin) {
      NotificationService().error(translate(common.valuesDoNotMatch));
      return null;
    }

    return pin;
  }

  // --------------------------------

  /** Check if a biometric key exists in platform storage. */
  async function hasBiometricKey(): Promise<boolean> {
    const { value: hasBioKey } = await SimpleEncryption.hasBiometricKey();
    return hasBioKey;
  }

  /** Remove biometric key from platform storage. No-op if none exists. */
  async function removeBiometricKey(): Promise<void> {
    await SimpleEncryption.removeBiometricKey();
  }

  /**
   * Full biometric unlock: load biometric key + load into plugin memory.
   * Keeps raw key out of UI code.
   */
  async function unlockWithBiometric(): Promise<void> {
    const { key } = await SimpleEncryption.loadBiometricKey({
      title: "Selene Wallet",
      reason: translate(common.authorizeThisAction),
    });
    await SimpleEncryption.loadKeyIntoMemory({ key });
  }

  /**
   * Re-auth biometric: verify biometric presence without key material.
   */
  async function verifyBiometric(reason?: string): Promise<void> {
    await SimpleEncryption.verifyBiometric({
      title: "Selene Wallet",
      reason,
    });
  }

  /** Export current encryption key and store in biometric-protected storage. */
  async function storeBiometricKeyFromCurrent(): Promise<void> {
    const { key } = await SimpleEncryption.exportCurrentKey();
    await SimpleEncryption.storeBiometricKey({ key });
  }

  /** Prompt user to open app settings when biometric permission is denied. */
  async function promptBiometricPermission(): Promise<void> {
    const shouldOpen = await ModalService().showConfirm({
      title: translate(securityTranslations.biometricPermissionRequired),
      message: translate(securityTranslations.biometricNotEnabled),
      confirmLabel: translate(securityTranslations.openSettings),
    });
    if (shouldOpen) {
      await SimpleEncryption.openAppSettings();
    }
  }

  /** Set or change PIN and update biometric key if available. Key must already be loaded. */
  async function changePinAndUpdateBiometric(
    newPin: string,
    hasBiometric?: boolean
  ): Promise<void> {
    await setPin(newPin);

    if (hasBiometric) {
      try {
        await storeBiometricKeyFromCurrent();
      } catch (bioErr) {
        Log.warn("Failed to store biometric key:", bioErr);
      }
    }
  }

  /** Export encryption key backup protected by a password. */
  async function exportKeyBackup(password: string): Promise<string> {
    const { data } = await SimpleEncryption.exportKeyBackup({ password });
    return data;
  }

  /**
   * Import an encryption key backup: save marker, import key, verify,
   * rollback on mismatch, update biometric key, re-encrypt all data.
   */
  async function importKeyBackup(
    data: string,
    password: string
  ): Promise<ImportKeyBackupResult> {
    const Database = DatabaseService();

    // Save old key as progress marker BEFORE import — if we crash after
    // importKeyBackup but before re-encryption, this marker lets us recover
    const { key: oldKeyBase64 } = await SimpleEncryption.exportCurrentKey();
    await Database.saveReencryptionMarker(oldKeyBase64);

    // Import new key (replaces in-memory + persistent key)
    await SimpleEncryption.importKeyBackup({ data, password });

    // Verify the imported key can decrypt existing databases
    try {
      await Database.testDecryptAppDb();
    } catch (verifyErr) {
      if (verifyErr instanceof DecryptionFailedError) {
        // Roll back: restore old key and clean up marker
        await SimpleEncryption.replaceKey({ key: oldKeyBase64 });
        await Database.clearReencryptionMarker();
        return { isSuccess: false, isKeyMismatch: true, failedFiles: [] };
      }
      // Non-decryption error (file missing etc.) — key might still be valid
    }

    // Update biometric key if available
    try {
      const hasBioKey = await hasBiometricKey();
      if (hasBioKey) {
        await storeBiometricKeyFromCurrent();
      }
    } catch (bioErr) {
      Log.warn("Failed to update biometric key:", bioErr);
    }

    // Re-encrypt all data with new key
    const failedFiles = await Database.reencryptAllData(oldKeyBase64);
    return { isSuccess: true, isKeyMismatch: false, failedFiles };
  }

  /** Set device-only key storage mode in the encryption plugin. */
  async function setDeviceOnlyMode(enabled: boolean): Promise<void> {
    await SimpleEncryption.setKeyStorageSettings({ deviceOnly: enabled });
  }

  /** Check whether all wallets have had their seed phrase viewed. */
  function allWalletsSeedViewed(): boolean {
    const allWallets = WalletManagerService().listWallets();
    return allWallets.every((w) => w.key_viewed_at !== null);
  }

  /** Reset all encryption state in the plugin. */
  async function resetEncryption(): Promise<void> {
    await SimpleEncryption.resetAll();
    hasPinConfigured = false;
  }
}

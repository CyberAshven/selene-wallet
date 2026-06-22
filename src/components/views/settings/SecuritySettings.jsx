import { useContext, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Clipboard } from "@capacitor/clipboard";
import { Share } from "@capacitor/share";
import {
  CloudSyncOutlined,
  CoffeeOutlined,
  ExportOutlined,
  EyeInvisibleOutlined,
  ImportOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LockOutlined,
  PushpinOutlined,
  SendOutlined,
  ShopOutlined,
  ThunderboltOutlined,
  VerifiedOutlined,
  WalletOutlined,
} from "@ant-design/icons";

import { selectDeviceInfo } from "@/redux/device";
import {
  selectEncryptionSettings,
  selectIsExperimental,
  selectSecuritySettings,
  setPreference,
} from "@/redux/preferences";
import { selectActiveWallet } from "@/redux/wallet";

import ModalService from "@/kernel/app/ModalService";
import NotificationService from "@/kernel/app/NotificationService";
import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";

import Accordion from "@/atoms/Accordion";
import Button from "@/atoms/Button";
import Checkbox from "@/atoms/Checkbox";
import KeyWarning from "@/atoms/KeyWarning/KeyWarning";
import Select from "@/components/atoms/Select";

import { translate } from "@/util/translations";
import translations from "./translations";

import { SettingsContext } from "./SettingsContext";

export default function SecuritySettings() {
  const dispatch = useDispatch();
  const { handleSettingsUpdate } = useContext(SettingsContext);

  const Modal = ModalService();
  const Security = SecurityService();
  const Notification = NotificationService();
  const [isPinConfigured, setIsPinConfigured] = useState(
    Security.isPinConfigured()
  );
  const { authMode, authActions, isNumericPin } = useSelector(
    selectSecuritySettings
  );
  const { hasBiometric, platform } = useSelector(selectDeviceInfo);
  const { isDeviceOnly, lastKeyBackupExport } = useSelector(
    selectEncryptionSettings
  );
  const activeWallet = useSelector(selectActiveWallet);
  const isExperimental = useSelector(selectIsExperimental);

  const handleSetPin = async () => {
    if (isPinConfigured) {
      const isAuthorized = await Security.authorize(AuthActions.Any);
      if (!isAuthorized) {
        return;
      }
    }

    const pin = await Security.promptForNewPin();
    if (!pin) return;

    try {
      await Security.changePinAndUpdateBiometric(pin, hasBiometric);
    } catch (e) {
      Notification.error(translate(translations.error), String(e));
      return;
    }
    setIsPinConfigured(true);
  };

  const handleSetAuthActions = async (action) => {
    let newAuthActions;

    if (authActions.includes(action)) {
      // require auth to disable any auth setting
      const isAuthorized = await Security.authorize(AuthActions.Any);
      if (!isAuthorized) {
        return;
      }

      newAuthActions = authActions.filter((a) => a !== action);
    } else {
      newAuthActions = [...authActions, action];
    }

    dispatch(
      setPreference({ key: "authActions", value: newAuthActions.join(";") })
    );
  };

  const isWalletKeyViewed = activeWallet.key_viewed_at !== null;

  // Shared helper: prompt for password, export key backup, share/copy result.
  // Returns true on success, false if user cancelled or export failed.
  const performKeyBackupExport = async () => {
    const password = await Security.promptForNewPin(/* forcePassword */ true);
    if (!password) return false;

    try {
      const data = await Security.exportKeyBackup(password);

      if ((await Share.canShare()).value) {
        await Share.share({
          title: translate(translations.encryptionKeyBackupTitle),
          text: data,
        });
      } else {
        await Clipboard.write({ string: data });
        Notification.success(translate(translations.backupCopiedToClipboard));
      }

      dispatch(
        setPreference({
          key: "lastKeyBackupExport",
          value: new Date().toISOString(),
        })
      );
      return true;
    } catch (e) {
      Notification.error(translate(translations.error), String(e));
      return false;
    }
  };

  const handleDeviceOnlyToggle = async () => {
    const shouldEnableDeviceOnly = !isDeviceOnly;

    if (shouldEnableDeviceOnly) {
      // Gate 1: Check ALL wallets have seed phrase viewed
      if (!Security.allWalletsSeedViewed()) {
        Notification.error(translate(translations.seedPhraseNotViewed));
        return;
      }

      // Gate 2: Force key backup export
      const isExported = await performKeyBackupExport();
      if (!isExported) {
        return;
      }
    }

    // Final confirmation
    const warningMessage = shouldEnableDeviceOnly
      ? translate(translations.deviceOnlyEnableWarning)
      : translate(translations.deviceOnlyDisableWarning);

    const isConfirmed = await Modal.showConfirm({
      title: translate(translations.deviceOnlyKeys),
      message: warningMessage,
    });

    if (isConfirmed) {
      try {
        await Security.setDeviceOnlyMode(shouldEnableDeviceOnly);
        dispatch(
          setPreference({
            key: "encryptionDeviceOnly",
            value: shouldEnableDeviceOnly.toString(),
          })
        );
      } catch (e) {
        Notification.error(translate(translations.error), String(e));
      }
    }
  };

  const handleAuthModeChange = async (event) => {
    const newMode = event.target.value;
    if (newMode === authMode) return;

    // Auth gate — skip for bio target since storeBiometricKey prompts itself
    if (newMode !== "bio") {
      const isAuthorized = await Security.authorize(AuthActions.Any);
      if (!isAuthorized) return;
    }

    try {
      // Target: none — full teardown
      if (newMode === "none") {
        await Security.removeBiometricKey();
        if (isPinConfigured) {
          await Security.removePin();
          setIsPinConfigured(false);
        }
      }

      // Target: pin or password — need PIN/password, no bio key
      if (newMode === "pin" || newMode === "password") {
        await Security.removeBiometricKey();
        const isPasswordMode = newMode === "password";
        const shouldPromptCredential =
          !isPinConfigured || isPasswordMode === isNumericPin;

        if (shouldPromptCredential) {
          const pin = await Security.promptForNewPin(isPasswordMode);
          if (!pin) return;
          await Security.setPin(pin);
          dispatch(
            setPreference({
              key: "pinInputMode",
              value: isPasswordMode ? "false" : "true",
            })
          );
          setIsPinConfigured(true);
        }
      }

      // Target: bio — PIN wraps key at rest, bio is fast unlock
      if (newMode === "bio") {
        if (!isPinConfigured) {
          const pin = await Security.promptForNewPin();
          if (!pin) return;
          await Security.setPin(pin);
          setIsPinConfigured(true);
        }
        await Security.storeBiometricKeyFromCurrent();
      }

      handleSettingsUpdate("authMode", newMode);
    } catch (e) {
      Notification.error(translate(translations.error), String(e));
    }
  };

  const handleExportBackup = async () => {
    const isAuthorized = await Security.authorize(AuthActions.Any);
    if (!isAuthorized) {
      return;
    }
    await performKeyBackupExport();
  };

  const handleImportBackup = async () => {
    const isAuthorized = await Security.authorize(AuthActions.Any);
    if (!isAuthorized) {
      return;
    }

    const data = await Modal.showPrompt({
      title: translate(translations.importKeyBackup),
      message: translate(translations.importKeyBackupMessage),
      placeholder: translate(translations.pasteBackupData),
    });

    if (!data) {
      return;
    }

    const password = await Modal.showPrompt({
      title: translate(translations.enterBackupPassword),
      message: translate(translations.enterBackupPasswordMessage),
      inputType: "password",
      placeholder: translate(translations.enterPassword),
    });

    if (!password) {
      return;
    }

    try {
      const cleanData = data.replace(/[^A-Za-z0-9+/=]/g, "");
      const result = await Security.importKeyBackup(cleanData, password);

      if (result.isKeyMismatch) {
        Notification.error(
          translate(translations.error),
          translate(translations.keyMismatch)
        );
        return;
      }

      if (result.failedFiles.length > 0) {
        Notification.error(
          translate(translations.warning),
          translate(translations.reencryptionPartialFailure)
        );
      } else {
        Notification.success(translate(translations.reencryptionSuccess));
      }
    } catch (e) {
      Notification.error(translate(translations.error), String(e));
    }
  };

  return (
    <Accordion icon={LockOutlined} title={translate(translations.security)}>
      <Accordion.Child
        icon={VerifiedOutlined}
        label={translate(translations.securityMode)}
        description={translate(translations.securityModeExplanation)}
      >
        {!isWalletKeyViewed ? (
          <KeyWarning walletHash={activeWallet.walletHash} />
        ) : (
          <Select
            className="w-fit"
            value={authMode}
            disabled={!isWalletKeyViewed}
            onChange={handleAuthModeChange}
          >
            <option value="none">{translate(translations.none)}</option>
            <option value="pin">{translate(translations.pin)}</option>
            <option value="password">{translate(translations.password)}</option>
            {hasBiometric && (
              <option value="bio">{translate(translations.biometric)}</option>
            )}
          </Select>
        )}
      </Accordion.Child>
      {authMode !== "none" && (
        <Accordion.Child
          icon={PushpinOutlined}
          label={
            authMode === "bio"
              ? translate(
                  isNumericPin
                    ? translations.pinFallback
                    : translations.passwordFallback
                )
              : undefined
          }
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex-1">
              {authMode !== "bio" &&
                (!isPinConfigured ? (
                  <span className="text-error font-semibold">
                    {translate(
                      isNumericPin
                        ? translations.pinNotSet
                        : translations.passwordNotSet
                    )}
                  </span>
                ) : (
                  <span className="text-success-dark font-semibold">
                    {translate(
                      isNumericPin
                        ? translations.pinSet
                        : translations.passwordSet
                    )}
                  </span>
                ))}
            </div>
            <Button
              onClick={handleSetPin}
              icon={PushpinOutlined}
              label={
                isNumericPin
                  ? translate(translations.resetPin)
                  : translate(translations.resetPassword)
              }
            />
          </div>
        </Accordion.Child>
      )}
      {authMode !== "none" && (isPinConfigured || authMode === "bio") && (
        <>
          <div className="text-lg font-semibold bg-neutral-600 text-neutral-100 p-1">
            {translate(translations.requireAuthorizationFor)}
          </div>
          <Accordion.Child
            icon={LockOutlined}
            label={translate(translations.appLock)}
            description={translate(translations.appLockDescription)}
          >
            <Checkbox
              checked={authActions.includes(AuthActions.AppOpen)}
              disabled
            />
          </Accordion.Child>
          <Accordion.Child
            icon={CoffeeOutlined}
            label={translate(translations.appResume)}
            description={translate(translations.appResumeDescription)}
          >
            <Checkbox
              checked={authActions.includes(AuthActions.AppResume)}
              onChange={() => handleSetAuthActions(AuthActions.AppResume)}
            />
          </Accordion.Child>
          <Accordion.Child
            icon={WalletOutlined}
            label={translate(translations.authWalletActivate)}
          >
            <Checkbox
              checked={authActions.includes(AuthActions.WalletActivate)}
              onChange={() => handleSetAuthActions(AuthActions.WalletActivate)}
            />
          </Accordion.Child>
          <Accordion.Child
            icon={EyeInvisibleOutlined}
            label={translate(translations.authRevealBalance)}
          >
            <Checkbox
              checked={authActions.includes(AuthActions.RevealBalance)}
              onChange={() => handleSetAuthActions(AuthActions.RevealBalance)}
            />
          </Accordion.Child>
          <Accordion.Child
            icon={SendOutlined}
            label={translate(translations.authSendTransaction)}
          >
            <Checkbox
              checked={authActions.includes(AuthActions.SendTransaction)}
              onChange={() => handleSetAuthActions(AuthActions.SendTransaction)}
            />
          </Accordion.Child>
          <Accordion.Child
            icon={ThunderboltOutlined}
            label={translate(translations.authInstantPay)}
          >
            <Checkbox
              checked={authActions.includes(AuthActions.InstantPay)}
              onChange={() => handleSetAuthActions(AuthActions.InstantPay)}
            />
          </Accordion.Child>
          <Accordion.Child
            icon={KeyOutlined}
            label={translate(translations.authRevealPrivateKeys)}
          >
            <Checkbox
              checked={authActions.includes(AuthActions.RevealPrivateKeys)}
              disabled={authActions.includes(AuthActions.RevealPrivateKeys)}
              onChange={() =>
                handleSetAuthActions(AuthActions.RevealPrivateKeys)
              }
            />
          </Accordion.Child>
          <Accordion.Child
            icon={ShopOutlined}
            label={translate(translations.authVendorMode)}
          >
            <Checkbox
              checked={authActions.includes(AuthActions.VendorMode)}
              onChange={() => handleSetAuthActions(AuthActions.VendorMode)}
            />
          </Accordion.Child>
        </>
      )}
      {platform === "web" && (
        <div className="flex items-center gap-2 p-2 m-1 mt-4 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded text-sm">
          <InfoCircleOutlined />
          <span>{translate(translations.webEncryptionWarning)}</span>
        </div>
      )}
      {platform !== "web" && isExperimental && (
        <>
          <div className="text-lg font-semibold bg-neutral-600 text-neutral-100 p-1 mt-4">
            {translate(translations.encryptionSettings)}
          </div>
          <Accordion.Child
            icon={CloudSyncOutlined}
            label={translate(translations.deviceOnlyKeys)}
            description={translate(translations.deviceOnlyKeysDescription)}
          >
            <Checkbox
              checked={isDeviceOnly}
              onChange={handleDeviceOnlyToggle}
            />
          </Accordion.Child>
          <Accordion.Child
            icon={ExportOutlined}
            label={translate(translations.exportKeyBackup)}
            description={translate(translations.exportKeyBackupDescription)}
          >
            <Button
              onClick={handleExportBackup}
              icon={ExportOutlined}
              label={translate(translations.exportButton)}
            />
          </Accordion.Child>
          <Accordion.Child
            icon={ImportOutlined}
            label={translate(translations.importKeyBackup)}
            description={translate(translations.importKeyBackupDescription)}
          >
            <Button
              onClick={handleImportBackup}
              icon={ImportOutlined}
              label={translate(translations.importButton)}
            />
          </Accordion.Child>
          {lastKeyBackupExport && (
            <Accordion.Child
              icon={InfoCircleOutlined}
              label={translate(translations.lastKeyBackup)}
            >
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {new Date(lastKeyBackupExport).toLocaleDateString()}
              </span>
            </Accordion.Child>
          )}
        </>
      )}
    </Accordion>
  );
}

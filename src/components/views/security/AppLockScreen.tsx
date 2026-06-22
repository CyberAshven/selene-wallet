import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { App as CapApp } from "@capacitor/app";
import { SimpleEncryption } from "capacitor-plugin-simple-encryption";

import { selectSecuritySettings } from "@/redux/preferences";

import LogService from "@/kernel/app/LogService";
import SecurityService from "@/kernel/app/SecurityService";

import FullColumn from "@/layout/FullColumn";
import Button from "@/atoms/Button";
import SeleneLogo from "@/atoms/SeleneLogo";

import { translate } from "@/util/translations";
import translations from "./translations";

import {
  ForgotPinMenu,
  LegacyRevealScreen,
  primaryButtonProps,
} from "./ForgotPinScreen";

const Security = SecurityService();

const Log = LogService("AppLockScreen");

const secondaryButtonProps = {
  ...primaryButtonProps,
  bgColor:
    "bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600",
  activeBgColor: "bg-neutral-300 dark:bg-neutral-600",
  labelColor: "text-neutral-900 dark:text-neutral-100 font-semibold",
  activeLabelColor: "text-neutral-900 dark:text-neutral-100",
} as const;

interface AppLockScreenProps {
  boot: () => Promise<void>;
}

function LockScreen({ boot }: AppLockScreenProps) {
  const navigate = useNavigate();
  const { authMode, isNumericPin } = useSelector(selectSecuritySettings);

  const isPinConfigured = Security.isPinConfigured();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Migration hasn't completed if plugin has no auth configured
  const [hasBioKey, setHasBioKey] = useState(false);
  useEffect(function checkBioKey() {
    Security.hasBiometricKey().then(setHasBioKey);
  }, []);
  const isMigrationPending =
    authMode !== "none" && !isPinConfigured && !hasBioKey;
  const isPasswordMode = !isNumericPin;
  const shouldShowPin =
    !isMigrationPending &&
    (isPinConfigured || authMode === "pin" || authMode === "password");
  const shouldShowBio = !isMigrationPending && authMode === "bio";

  // ----------------
  const tryBiometric = useCallback(
    async function tryBiometric() {
      try {
        setIsLoading(true);

        // Check permission first
        const { value: isBioAvailable } =
          await SimpleEncryption.isBiometricAvailable();
        if (!isBioAvailable) {
          setIsLoading(false);
          await Security.promptBiometricPermission();
          return false;
        }

        const isBioKeyAvailable = await Security.hasBiometricKey();

        if (isBioKeyAvailable) {
          await Security.unlockWithBiometric();
          await boot();
          return true;
        }

        // No bio key — need to unlock with PIN first to enable biometric
        setError(translate(translations.enterPinToEnableBiometric));
        setIsLoading(false);
        return false;
      } catch (e) {
        Log.debug("Biometric unlock failed or cancelled", e);
        setIsLoading(false);
        return false;
      }
    },
    [boot]
  );

  // Auto-trigger biometric on mount (only when bio key exists, not during migration)
  useEffect(
    function attemptBiometricUnlock() {
      if (shouldShowBio) {
        Security.hasBiometricKey().then((isBioKeyAvailable) => {
          if (isBioKeyAvailable) tryBiometric();
        });
      }
    },
    [tryBiometric, shouldShowBio]
  );

  // ----------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || isLoading) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const isReady = await Security.initEncryption(pin);
      if (!isReady) {
        setError(translate(translations.failedToUnlock));
        return;
      }
      Log.log("PIN unlock successful");

      // If bio mode but no bio key, attempt to store one now
      if (authMode === "bio" && !(await Security.hasBiometricKey())) {
        const { value: isBioAvailable } =
          await SimpleEncryption.isBiometricAvailable();
        if (!isBioAvailable) {
          await Security.promptBiometricPermission();
        } else {
          try {
            await Security.storeBiometricKeyFromCurrent();
            Log.log("Biometric key stored after PIN unlock");
          } catch {
            Log.log("Biometric key not stored (cancelled)");
          }
        }
      }

      await boot();
    } catch (err) {
      Log.error("PIN unlock failed", err);
      setError(
        translate(
          isPasswordMode
            ? translations.incorrectPassword
            : translations.incorrectPin
        )
      );
    } finally {
      setPin("");
      setIsLoading(false);
    }
  };

  const handleMigrationBoot = async () => {
    setIsLoading(true);
    setError("");
    try {
      await boot();
    } catch (e) {
      Log.error("Migration boot failed", e);
      setError(
        e instanceof Error ? e.message : translate(translations.failedToUnlock)
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------
  return (
    <FullColumn className="justify-center items-center bg-neutral-100 dark:bg-neutral-900 p-4 overflow-y-auto">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <SeleneLogo className="w-32 h-32" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Selene Wallet
          </h1>
        </div>

        {isMigrationPending && (
          <div className="p-2 my-4 flex flex-col gap-2">
            <Button
              {...primaryButtonProps}
              label={translate(translations.unlock)}
              disabled={isLoading}
              onClick={handleMigrationBoot}
            />
            {error && (
              <div className="mb-4 p-2 bg-error-light/20 dark:bg-error-dark/30 text-error dark:text-error-light rounded text-center text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {shouldShowPin && (
          <form
            onSubmit={handleSubmit}
            className="p-2 my-4 flex flex-col gap-2"
          >
            <input
              type="password"
              inputMode={isPasswordMode ? undefined : "numeric"}
              pattern={isPasswordMode ? undefined : "[0-9]*"}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={translate(
                isPasswordMode
                  ? translations.enterPassword
                  : translations.enterPin
              )}
              className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-50 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-center text-xl tracking-widest"
              autoFocus
              disabled={isLoading}
            />

            {error && (
              <div className="mb-4 p-2 bg-error-light/20 dark:bg-error-dark/30 text-error dark:text-error-light rounded text-center text-sm">
                {error}
              </div>
            )}

            <Button
              submit
              {...primaryButtonProps}
              label={translate(translations.unlock)}
              disabled={isLoading}
            />
          </form>
        )}

        {shouldShowBio && (
          <div className={shouldShowPin ? "mt-3" : ""}>
            <Button
              {...(shouldShowPin ? secondaryButtonProps : primaryButtonProps)}
              label={translate(translations.useBiometric)}
              onClick={tryBiometric}
              disabled={isLoading}
            />
          </div>
        )}

        <div className="mt-4">
          <Button
            label={translate(translations.forgotPin)}
            onClick={() => navigate("/forgot-pin")}
            labelSize="md"
            labelColor="text-primary-500"
            activeLabelColor="text-primary-600"
            bgColor="bg-transparent"
            activeBgColor="bg-transparent"
            borderClasses=""
            shadow="none"
            padding="0"
          />
        </div>

        {shouldShowPin && (
          <p className="mt-4 text-neutral-600 dark:text-neutral-400 text-center">
            {translate(translations.pinProtectionInfo)}
          </p>
        )}
      </div>
    </FullColumn>
  );
}

function HardwareBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(
    function handleHardwareBack() {
      const listener = CapApp.addListener("backButton", () => {
        if (location.pathname !== "/") {
          navigate(-1);
        }
      });
      return () => {
        listener.then((l) => l.remove());
      };
    },
    [navigate, location.pathname]
  );

  return null;
}

export default function AppLockScreen({ boot }: AppLockScreenProps) {
  return (
    <MemoryRouter>
      <HardwareBackHandler />
      <Routes>
        <Route path="/" element={<LockScreen boot={boot} />} />
        <Route path="/forgot-pin" element={<ForgotPinMenu />} />
        <Route path="/forgot-pin/reveal" element={<LegacyRevealScreen />} />
      </Routes>
    </MemoryRouter>
  );
}

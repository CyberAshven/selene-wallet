import { ReactNode, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";

import {
  redux_init,
  redux_pause,
  redux_pre_init,
  redux_resume,
  store,
} from "@/redux";
import { selectIsDarkMode, selectSecuritySettings } from "@/redux/preferences";

import DatabaseService, {
  DecryptionFailedError,
} from "@/kernel/app/DatabaseService";
import JanitorService from "@/kernel/app/JanitorService";
import LogService from "@/kernel/app/LogService";
import { ModalProvider } from "@/kernel/app/ModalService";
import { NotificationProvider } from "@/kernel/app/NotificationService";
import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";

import AppLockScreen from "@/views/security/AppLockScreen";
import ErrorBoundary from "@/layout/ErrorBoundary";

const Log = LogService("AppProvider");

// --------------------------------

type Phase =
  | "PREFLIGHT"
  | "MIGRATING"
  | "LOCKED"
  | "RUNNING"
  | "PAUSED"
  | "STARTUP_ERROR";

// --------------------------------

function useAppLifecycle() {
  const [phase, setPhase] = useState<Phase>("PREFLIGHT");
  const [startupError, setStartupError] = useState<Error | null>(null);
  const phaseRef = useRef<Phase>("PREFLIGHT");
  const pausePromiseRef = useRef<Promise<void> | null>(null);
  const bootRef = useRef<() => Promise<void>>();

  // Keeps phaseRef in sync after renders; go() sets it eagerly for mid-async reads
  phaseRef.current = phase;

  // ----------------
  // Mount-only: cold start + lifecycle listeners.
  // All lifecycle functions defined inside the effect — no dep array issues.
  useEffect(function mount() {
    function go(next: Phase) {
      setPhase(next);
      phaseRef.current = next;
    }

    // --------
    async function boot() {
      Log.log("* BOOT *");
      Log.time("boot");

      if (pausePromiseRef.current) {
        await pausePromiseRef.current;
        pausePromiseRef.current = null;
      }

      try {
        await DatabaseService().openAppDatabase();
        await JanitorService().migrateLegacyDatabases();
        await JanitorService().recoverWalletFiles();

        if (!(await JanitorService().handleAuthMigration())) {
          Log.timeEnd("boot");
          go("LOCKED");
          return;
        }
        await redux_init();
        redux_resume();

        go("RUNNING");
        Log.timeEnd("boot");
      } catch (e) {
        Log.error("BOOT FAILED", e);
        setStartupError(e instanceof Error ? e : new Error(String(e)));
        go("STARTUP_ERROR");
        Log.timeEnd("boot");
      }
    }

    bootRef.current = boot;

    // --------
    async function coldStart() {
      Log.time("INIT");

      try {
        await Promise.all([JanitorService().fsck(), redux_pre_init()]);

        const { authMode, authActions } = selectSecuritySettings(
          store.getState()
        );

        const isKeyLoaded = await SecurityService().initEncryption();

        const shouldLock =
          !isKeyLoaded ||
          (authMode !== "none" && authActions.includes(AuthActions.AppOpen));

        if (shouldLock) {
          go("LOCKED");
        } else {
          go("MIGRATING");
          await boot();
        }
      } catch (e) {
        if (e instanceof DecryptionFailedError) {
          Log.error("Decryption failed, routing to lock screen", e);
          go("LOCKED");
        } else {
          Log.error("INIT FAILED", e);
          setStartupError(e instanceof Error ? e : new Error(String(e)));
          go("STARTUP_ERROR");
        }
      }

      Log.timeEnd("INIT");
    }

    coldStart();

    // --------
    async function handlePause() {
      Log.time("APP_PAUSE");

      if (phaseRef.current !== "RUNNING") {
        Log.debug("APP_PAUSE ignored (phase:", phaseRef.current, ")");
        Log.timeEnd("APP_PAUSE");
        return;
      }

      const { authMode, authActions } = selectSecuritySettings(
        store.getState()
      );
      const shouldLock =
        authMode !== "none" && authActions.includes(AuthActions.AppResume);

      // Transition synchronously BEFORE async work to prevent resume race
      if (shouldLock) {
        go("PAUSED");
      }

      const cleanup = (async () => {
        try {
          await redux_pause();
          if (shouldLock) {
            await SecurityService().securePause();
          }
        } catch (e) {
          Log.error("APP_PAUSE failed", e);
        }
      })();
      pausePromiseRef.current = cleanup;
      await cleanup;

      Log.timeEnd("APP_PAUSE");
    }

    function handleResume() {
      Log.time("APP_RESUME");
      const { current } = phaseRef;

      if (current === "PAUSED") {
        go("LOCKED");
      } else if (current === "RUNNING") {
        redux_resume();
      }

      Log.timeEnd("APP_RESUME");
    }

    App.addListener("pause", handlePause);
    App.addListener("resume", handleResume);

    return () => {
      App.removeAllListeners();
    };
  }, []);

  // ----------------
  // Hide splash on first transition out of PREFLIGHT
  useEffect(
    function hideSplash() {
      if (phase !== "PREFLIGHT") {
        SplashScreen.hide();
      }
    },
    [phase]
  );

  return {
    phase,
    startupError,
    boot: () => bootRef.current?.() ?? Promise.resolve(),
  };
}

// --------------------------------

interface AppProviderProps {
  children: ReactNode;
}

export default function AppProvider({ children }: AppProviderProps) {
  const { phase, startupError, boot } = useAppLifecycle();
  const isDarkMode = useSelector(selectIsDarkMode);

  // Apply dark class to <html> synchronously — must run before paint to avoid flash.
  // This is intentionally in the render body, not useEffect.
  const html = document.documentElement;
  if (isDarkMode) {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }

  let content: ReactNode = null;
  switch (phase) {
    case "PREFLIGHT":
    case "PAUSED":
      break; // native splash covers; PAUSED = cleanup in progress
    case "MIGRATING":
      break; // splash hidden, migration in progress (modal/bio prompt overlays)
    case "LOCKED":
      content = <AppLockScreen boot={boot} />;
      break;
    case "RUNNING":
      content = children;
      break;
    case "STARTUP_ERROR":
    default:
      content = (
        <ErrorBoundary
          startupError={startupError ?? new Error(`Unknown phase: ${phase}`)}
        />
      );
      break;
  }

  return (
    <div id="container">
      {content}
      <ModalProvider />
      <NotificationProvider />
    </div>
  );
}

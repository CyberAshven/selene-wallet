import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCode } from "react-qrcode-logo";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { App } from "@capacitor/app";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { ScreenBrightness } from "@capacitor-community/screen-brightness";
import { CloseOutlined } from "@ant-design/icons";

import { selectDeviceInfo, setOrientationLock } from "@/redux/device";
import {
  selectBchNetwork,
  selectIsVendorModeKeepAwake,
  selectQrCodeSettings,
  selectShouldUseLegacyBip21,
  setPreference,
} from "@/redux/preferences";
import { selectIsSyncing } from "@/redux/sync";
import { selectActiveWalletHash } from "@/redux/wallet";

import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";
import AddressManagerService from "@/kernel/wallet/AddressManagerService";

import CurrencyFlip from "@/atoms/CurrencyFlip";
import Satoshi from "@/atoms/Satoshi";

import { useCurrencyFlip } from "@/hooks/useCurrencyFlip";

import { logos } from "@/util/logos";
import { satsToBch } from "@/util/sats";
import { toAlphanumericUri } from "@/util/uri";

import VendorNumpad from "./VendorNumpad";

export default function VendorModeView() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const walletHash = useSelector(selectActiveWalletHash);
  const bchNetwork = useSelector(selectBchNetwork);
  const qrCodeSettings = useSelector(selectQrCodeSettings);
  const deviceInfo = useSelector(selectDeviceInfo);
  const isKeepAwake = useSelector(selectIsVendorModeKeepAwake);
  const shouldUseLegacyBip21 = useSelector(selectShouldUseLegacyBip21);
  const isSyncing = useSelector(selectIsSyncing);

  // Get receive address — re-query when sync finishes
  const AddressManager = useMemo(
    () => AddressManagerService(walletHash),
    [walletHash]
  );
  const addressRef = useRef("");
  const address = useMemo(() => {
    if (!isSyncing) {
      const unused = AddressManager.getUnusedAddresses(1);
      addressRef.current = unused.length > 0 ? unused[0].address : "";
    }
    return addressRef.current;
  }, [AddressManager, isSyncing]);

  // Amount state (in satoshis)
  const [satoshiAmount, setSatoshiAmount] = useState(0n);

  // Generate BIP21 URI for QR code
  // PayPro CHIP-2023-05: use ?s= (satoshis) by default, ?amount= (BCH) for legacy
  // PayPro format uses alphanumeric encoding for more efficient QR codes
  const qrValue = useMemo(() => {
    if (satoshiAmount === 0n) {
      return address;
    }
    if (shouldUseLegacyBip21) {
      return `${address}?amount=${satsToBch(satoshiAmount).bch}`;
    }
    return toAlphanumericUri(`${address}?s=${satoshiAmount}`);
  }, [address, satoshiAmount, shouldUseLegacyBip21]);

  const qrLogoImage = logos[qrCodeSettings.logo.toLowerCase()].img;

  const handleCurrencyFlip = useCurrencyFlip();

  // ----------------
  // Auth-gated exit: X button and back button share this handler
  const handleExit = useCallback(async () => {
    const isAuthorized = await SecurityService().authorize(
      AuthActions.VendorMode
    );
    if (isAuthorized) {
      dispatch(setPreference({ key: "vendorModeActive", value: "false" }));
      navigate("/wallet");
    }
  }, [dispatch, navigate]);

  // Intercept Android hardware back button
  useEffect(
    function handleBackButton() {
      const listener = App.addListener("backButton", () => {
        handleExit();
      });

      return function cleanup() {
        listener.then((l) => l.remove());
      };
    },
    [handleExit]
  );

  // ----------------
  // Vendor mode lifecycle: orientation, brightness, keep awake
  const previousBrightness = useRef<number | null>(null);
  const MIN_VENDOR_BRIGHTNESS = 0.5;

  useEffect(
    function handleVendorModeLifecycle() {
      dispatch(setOrientationLock("landscape"));

      if (deviceInfo.platform !== "web") {
        if (isKeepAwake) {
          KeepAwake.keepAwake();
        }

        (async () => {
          try {
            const { brightness } = await ScreenBrightness.getBrightness();
            previousBrightness.current = brightness;
            if (brightness < MIN_VENDOR_BRIGHTNESS) {
              await ScreenBrightness.setBrightness({
                brightness: MIN_VENDOR_BRIGHTNESS,
              });
            }
          } catch {
            // brightness API unavailable
          }
        })();
      }

      return function cleanup() {
        dispatch(setOrientationLock("portrait"));

        if (deviceInfo.platform !== "web") {
          KeepAwake.allowSleep();

          if (previousBrightness.current !== null) {
            ScreenBrightness.setBrightness({
              brightness: previousBrightness.current,
            }).catch(() => {});
          }
        }
      };
    },
    [dispatch, deviceInfo.platform, isKeepAwake]
  );

  const isTestnet = bchNetwork !== "mainnet";
  const qrBgColor = isTestnet ? "#ffffff" : qrCodeSettings.background;
  const qrFgColor = isTestnet ? "#000000" : qrCodeSettings.foreground;

  return (
    <div className="relative flex h-full w-full bg-white dark:bg-neutral-900">
      <button
        type="button"
        onClick={handleExit}
        className="absolute top-3 left-3 z-10 p-2 cursor-pointer text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
      >
        <CloseOutlined className="text-xl" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div
          className={`border-4 ${isTestnet ? "border-[#ff0000]" : "border-primary-700 dark:border-primarydark-200"}`}
        >
          <QRCode
            value={qrValue}
            size={200}
            quietZone={12}
            bgColor={qrBgColor}
            fgColor={qrFgColor}
            logoImage={qrLogoImage}
            logoWidth={48}
            logoHeight={48}
          />
        </div>
        <button
          type="button"
          onClick={handleCurrencyFlip}
          className="mt-4 text-center cursor-pointer"
        >
          <div
            data-testid="vendor-amount"
            className="text-4xl font-bold text-neutral-800 dark:text-neutral-100"
          >
            <Satoshi value={satoshiAmount} forceVisible />
          </div>
          <div className="text-lg text-neutral-500 dark:text-neutral-400 flex items-center justify-center">
            <Satoshi value={satoshiAmount} forceVisible flip />
            <CurrencyFlip className="ml-1.5 text-sm" />
          </div>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xs h-full max-h-80">
          <VendorNumpad onChange={setSatoshiAmount} />
        </div>
      </div>
    </div>
  );
}

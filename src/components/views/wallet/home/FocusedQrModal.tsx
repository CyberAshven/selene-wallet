import { useEffect, useRef } from "react";
import { QRCode } from "react-qrcode-logo";
import { useSelector } from "react-redux";
import { ScreenBrightness } from "@capacitor-community/screen-brightness";

import { selectBchNetwork, selectQrCodeSettings } from "@/redux/preferences";

import translations from "@/views/wallet/translations";
import Address from "@/atoms/Address";
import Modal from "@/atoms/Modal";
import Satoshi from "@/atoms/Satoshi";

import { logos } from "@/util/logos";
import { validateBip21Uri } from "@/util/uri";

import { translate } from "@/util/translations";

interface FocusedQrModalProps {
  qrRequest: string;
  onClose: () => void;
}

export default function FocusedQrModal({
  qrRequest,
  onClose,
}: FocusedQrModalProps) {
  const bchNetwork = useSelector(selectBchNetwork);
  const qrCodeSettings = useSelector(selectQrCodeSettings);

  const { address, satoshis, isTokenAddress } = validateBip21Uri(qrRequest);

  const qrLogoImage = isTokenAddress
    ? logos[qrCodeSettings.logo.toLowerCase()].img_tokens
    : logos[qrCodeSettings.logo.toLowerCase()].img;

  // Force red border/bg for non-mainnet
  const isTestnet = bchNetwork !== "mainnet";
  const qrBgColor = isTestnet ? "#ffffff" : qrCodeSettings.background;
  const qrFgColor = isTestnet ? "#000000" : qrCodeSettings.foreground;

  // -------- Brightness boost
  const previousBrightness = useRef<number | null>(null);

  useEffect(function boostBrightness() {
    ScreenBrightness.getBrightness()
      .then(({ brightness }) => {
        previousBrightness.current = brightness;
        // Scale relative to current brightness (proxy for ambient light).
        // Boost by 30%, clamp to 0.5–1.0 range.
        const target = Math.min(1.0, Math.max(0.5, brightness * 1.3));
        return ScreenBrightness.setBrightness({ brightness: target });
      })
      .catch(() => {});

    return () => {
      if (previousBrightness.current !== null) {
        ScreenBrightness.setBrightness({
          brightness: previousBrightness.current,
        }).catch(() => {});
      }
    };
  }, []);

  return (
    <Modal
      onClose={onClose}
      className="justify-center items-center bg-primary-200 dark:bg-primarydark-100 dark:text-neutral-100"
    >
      {satoshis && (
        <div className="mt-1 text-center">
          <div className="font-bold text-2xl">
            {translate(translations.requestAmount)}
          </div>
          <div className="font-bold text-2xl">
            <Satoshi value={satoshis} forceVisible />
          </div>
        </div>
      )}

      <div className="m-2 flex items-center justify-center">
        <div
          className={`border-4 ${isTestnet ? "border-[#ff0000]" : "border-primary-700 dark:border-primarydark-400"}`}
        >
          <QRCode
            value={qrRequest}
            ecLevel="L"
            size={220}
            quietZone={16}
            bgColor={qrBgColor}
            fgColor={qrFgColor}
            logoImage={qrLogoImage}
            logoWidth={48}
            logoHeight={48}
          />
        </div>
      </div>

      <div className="w-full p-1 text-sm text-center">
        <Address address={address} className="break-all" />
      </div>
    </Modal>
  );
}

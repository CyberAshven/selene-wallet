import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import { QrcodeOutlined } from "@ant-design/icons";

import { selectInstantPaySettings } from "@/redux/preferences";

import WalletViewButtons from "@/views/wallet/home/WalletViewButtons";
import Overlay from "@/atoms/Overlay";
import Satoshi from "@/atoms/Satoshi";

import { useScanner } from "@/hooks/useScanner";

import { navigateOnValidUri } from "@/util/uri";

export default function ScannerOverlay({
  prefilledAmount = 0n,
}: {
  prefilledAmount?: bigint;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleScan = useCallback(
    async (scanContent) => {
      let uri = scanContent;

      if (prefilledAmount > 0n && !uri.includes("?")) {
        uri = `${uri}?s=${prefilledAmount}`;
      }

      const { navTo, navState } = await navigateOnValidUri(uri);
      if (navTo !== "") {
        navigate(navTo, { state: { ...location.state, ...navState } });
      }
    },
    [location.state, navigate, prefilledAmount]
  );

  useScanner(handleScan);

  const { isInstantPayEnabled, instantPayThreshold } = useSelector(
    selectInstantPaySettings
  );
  return (
    <Overlay transparent blur={false}>
      <div className="pointer-events-auto flex flex-col justify-center items-center w-full h-full">
        {isInstantPayEnabled && (
          <div className="mb-4 bg-black/50 text-white/80 rounded-sm z-10 text-center p-3 rounded-xl">
            <div className="text-3xl font-bold">Instant Pay Enabled</div>
            <div className="text-xl font-semibold">
              Threshold: <Satoshi value={instantPayThreshold} />
            </div>
            {prefilledAmount > 0n && (
              <div className="text-xl font-semibold">
                Prefilled: <Satoshi value={prefilledAmount} />
              </div>
            )}
          </div>
        )}
        <div
          className="w-[80%] aspect-square rounded-xl flex items-center justify-center border border-4 border-primary opacity-90"
          style={{ boxShadow: "0 0 0 100vh #232323" }}
        >
          <QrcodeOutlined
            className="text-4xl opacity-80 text-primary border-2 border-primary rounded-sm"
            style={{ filter: "drop-shadow(0 0 4px #8dc351)" }}
          />
        </div>
      </div>

      <div className="pointer-events-auto align-end mb-[64px]">
        <WalletViewButtons />
      </div>
    </Overlay>
  );
}

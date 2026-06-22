import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Outlet, useNavigate } from "react-router";
import { SyncOutlined } from "@ant-design/icons";

import { selectScannerIsScanning } from "@/redux/device";
import {
  selectBchNetwork,
  selectIsVendorModeActive,
} from "@/redux/preferences";
import { selectIsConnected } from "@/redux/sync";
import { selectActiveWalletHash, selectGenesisHeight } from "@/redux/wallet";

import ElectrumService from "@/kernel/bch/ElectrumService";

import BalanceHideButton from "@/views/wallet/home/BalanceHideButton";
import SyncIndicator from "@/views/wallet/home/SyncIndicator";
import WalletViewBalance from "@/views/wallet/home/WalletViewBalance";
import FullColumn from "@/layout/FullColumn";

export default function WalletView() {
  const walletHash = useSelector(selectActiveWalletHash);
  const genesis_height = useSelector(selectGenesisHeight);
  const isScanning = useSelector(selectScannerIsScanning);
  const isConnected = useSelector(selectIsConnected);
  const bchNetwork = useSelector(selectBchNetwork);
  const isVendorModeActive = useSelector(selectIsVendorModeActive);
  const navigate = useNavigate();

  useEffect(
    // force wallet rebuild if genesis_height === null
    function initialWalletBuild() {
      if (
        genesis_height === null &&
        (isConnected || ElectrumService(bchNetwork).getIsConnected())
      ) {
        requestAnimationFrame(() =>
          navigate(`/settings/wallet/wizard/import/build/${walletHash}`)
        );
      }
    },
    [isConnected, genesis_height, walletHash, navigate, bchNetwork]
  );

  return walletHash === "" ? (
    <div className="p-2 flex items-center justify-center fixed top-1/3 w-full text-center">
      <SyncOutlined className="text-4xl" />
    </div>
  ) : (
    <FullColumn>
      {!isScanning && !isVendorModeActive && (
        <div className="flex bg-neutral-900 dark:bg-black justify-between">
          <div className="flex flex-col justify-center px-5">
            <BalanceHideButton className="text-xl" />
          </div>
          <WalletViewBalance />
          <div className="flex flex-col justify-center px-5">
            <SyncIndicator />
          </div>
        </div>
      )}
      <Outlet />
    </FullColumn>
  );
}

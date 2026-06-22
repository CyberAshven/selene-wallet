import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { DisconnectOutlined, SyncOutlined } from "@ant-design/icons";

import { selectBchNetwork } from "@/redux/preferences";
import { selectSyncState } from "@/redux/sync";
import { walletBoot } from "@/redux/wallet";

import ElectrumService from "@/kernel/bch/ElectrumService";
import AddressScannerService from "@/kernel/wallet/AddressScannerService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import { translate } from "@/util/translations";
import translations from "./translations";

const { importingWallet, takesMinutes } = translations;

export default function SettingsWalletWizardBuild() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { walletHash } = useParams();
  const bchNetwork = useSelector(selectBchNetwork);
  const { isConnected } = useSelector(selectSyncState);

  const [isBuilding, setIsBuilding] = useState(false);
  const [isBuildDone, setIsBuildDone] = useState(false);
  const [addressesScanned, setAddressesScanned] = useState(0);

  useEffect(
    function startBuild() {
      const scan = async () => {
        const WalletManager = WalletManagerService();
        await WalletManager.openWalletDatabase(walletHash);
        const wallet = WalletManager.getWallet(walletHash);

        if (isBuildDone) {
          await dispatch(walletBoot({ walletHash: wallet.walletHash }));

          navigate("/");
          return;
        }

        if (isBuilding) {
          if (ElectrumService(bchNetwork).getIsConnected()) {
            await AddressScannerService(wallet).rebuildWallet((scanCount) =>
              requestAnimationFrame(() =>
                setAddressesScanned((scanned) => scanned + scanCount)
              )
            );
            setIsBuildDone(true);
          } else {
            setIsBuilding(false);
          }
        }

        if (!isBuilding) {
          setIsBuilding(true);
        }
      };

      scan();
    },
    [
      isBuilding,
      bchNetwork,
      walletHash,
      dispatch,
      isBuildDone,
      navigate,
      isConnected,
    ]
  );

  return (
    <div>
      <h2 className="text-2xl text-center">{translate(importingWallet)}</h2>
      <h3 className="text-xl text-center">{translate(takesMinutes)}</h3>
      <div className="flex justify-center items-center my-2">
        {isConnected ? (
          <SyncOutlined className="text-5xl" spin />
        ) : (
          <DisconnectOutlined className="text-error text-5xl" />
        )}
      </div>
      {isConnected ? (
        <div className="text-center">Scanned {addressesScanned} addresses</div>
      ) : (
        <div className="text-center text-error text-lg">Not Connected</div>
      )}
    </div>
  );
}

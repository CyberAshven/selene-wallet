/* eslint-disable */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useParams } from "react-router";
import {
  DisconnectOutlined,
  SyncOutlined,
  WifiOutlined,
} from "@ant-design/icons";

import { selectBchNetwork, selectIsOfflineMode } from "@/redux/preferences";
import { selectSyncState, syncHotRefresh } from "@/redux/sync";

import LogService from "@/kernel/app/LogService";
import AddressManagerService from "@/kernel/wallet/AddressManagerService";
import AddressScannerService from "@/kernel/wallet/AddressScannerService";
import KeyManagerService from "@/kernel/wallet/KeyManagerService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import AssetsViewAddresses from "@/views/assets/AssetsViewAddresses";
import ViewHeader from "@/layout/ViewHeader";
import Button from "@/atoms/Button";

import { DEFAULT_DERIVATION_PATH, DERIVATION_PATHS } from "@/util/derivation";
import { DEFAULT_ELECTRUM_PORT, ElectrumServer } from "@/util/network";

export default function SettingsWalletScanTool() {
  const { walletHash } = useParams();
  const bchNetwork = useSelector(selectBchNetwork);
  const location = useLocation();

  const dispatch = useDispatch();

  const { server } = useSelector(selectSyncState);
  const serverParts = ElectrumServer.toParts(server);
  const electrumHostname =
    serverParts.port !== DEFAULT_ELECTRUM_PORT || bchNetwork !== "mainnet"
      ? server
      : serverParts.host;

  const isOfflineMode = useSelector(selectIsOfflineMode);

  const WalletManager = WalletManagerService();
  const wallet = WalletManager.getWallet(walletHash);

  const AddressManager = AddressManagerService(walletHash);

  const receiveAddresses = AddressManager.getReceiveAddresses();
  const changeAddresses = AddressManager.getChangeAddresses();

  const unusedReceiveAddresses = receiveAddresses.filter(
    (a) => a.state === null
  );
  const unusedChangeAddresses = changeAddresses.filter((a) => a.state === null);

  const [foundPath, setFoundPath] = useState("");
  const [scanCount, setScanCount] = useState(0);

  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(1000);
  const [nScanMore, setNScanMore] = useState(1200);

  const [changeMode, setChangeMode] = useState(0b11);

  const handleScanDerivationPaths = async () => {
    const found = await AddressScannerService(wallet).scanDerivationPaths();
    setFoundPath(found);
  };

  const handleSetStartIndex = (event) => {
    setStartIndex(Number.parseInt(event.target.value));
  };

  const handleSetEndIndex = (event) => {
    setEndIndex(Number.parseInt(event.target.value));
  };

  const handleSetNScanMore = (event) => {
    setNScanMore(Number.parseInt(event.target.value));
  };

  const handleChangeModeCheckbox = (event) => {
    const newMode = changeMode ^ event.target.value;
    setChangeMode(newMode);
  };

  const handleScan = async () => {
    setScanCount(-1);

    let scannedAddresses = [];
    switch (changeMode) {
      case 0:
      case 1:
        scannedAddresses = await AddressScannerService(wallet).scanAddresses(
          startIndex,
          endIndex,
          changeMode
        );
        break;

      case -1:
      default:
        scannedAddresses = (
          await Promise.all([
            AddressScannerService(wallet).scanAddresses(
              startIndex,
              endIndex,
              0
            ),
            AddressScannerService(wallet).scanAddresses(
              startIndex,
              endIndex,
              1
            ),
          ])
        ).flat();
        break;
    }

    setScanCount(scannedAddresses.length);
  };

  const handleScanMore = async () => {
    setScanCount(-1);
    let scannedAddresses = [];

    switch (changeMode) {
      case 1:
      case 2:
        scannedAddresses = await AddressScannerService(
          wallet
        ).scanMoreAddresses(nScanMore, changeMode - 1);
        break;

      case 3:
        scannedAddresses = (
          await Promise.all([
            AddressScannerService(wallet).scanMoreAddresses(nScanMore, 0),
            AddressScannerService(wallet).scanMoreAddresses(nScanMore, 1),
          ])
        ).flat();
        break;

      default:
      case 0:
        break;
    }
    setScanCount(scannedAddresses.length);
  };

  const handleRebuildWallet = async () => {
    setScanCount(-1);
    await AddressScannerService(wallet).rebuildWallet();
    setScanCount(-99);
  };

  const handleClearWalletData = () => {
    WalletManagerService().clearWalletData(walletHash);
  };

  return (
    <>
      <ViewHeader icon={SyncOutlined} title="Address Scan Tool" />
      <div className="">
        <div className="rounded bg-neutral-200 p-1 text-sm">
          <div className="flex items-center gap-x-1">
            {electrumHostname === "" ? (
              <>
                <DisconnectOutlined className="text-base" />
                <span>Not Connected</span>
                {isOfflineMode && <span>[Offline Mode]</span>}
              </>
            ) : (
              <>
                <WifiOutlined className="text-base" />
                <span>Connected to</span>
                <span className="font-mono">{electrumHostname}</span>
              </>
            )}
          </div>
          {bchNetwork !== "mainnet" && (
            <div className="text-error font-bold p-0.5 text-center">
              [{bchNetwork.toUpperCase()}]
            </div>
          )}
        </div>
        <div className="flex items-center gap-x-2 py-1">
          <label className="cursor-pointer">
            <input
              type="checkbox"
              checked={(changeMode & 0b01) > 0b00}
              value={0b01}
              onChange={handleChangeModeCheckbox}
              className="text-sm p-2 my-1"
            />{" "}
            Receive
          </label>
          <label className="cursor-pointer">
            <input
              type="checkbox"
              checked={(changeMode & 0b10) > 0b00}
              value={0b10}
              onChange={handleChangeModeCheckbox}
              className="text-sm p-2 my-1"
            />{" "}
            Change
          </label>
        </div>
        <div className="flex mb-1">
          <Button
            label="Scan Derivation Paths"
            rounded="md"
            onClick={handleScanDerivationPaths}
          />
          <Button
            label="Rebuild Wallet"
            onClick={handleRebuildWallet}
            rounded="md"
          />
          <Button
            label="Clear Wallet Data"
            onClick={handleClearWalletData}
            rounded="md"
          />
        </div>
        <div className="flex justify-between">
          <input
            className="w-32"
            type="number"
            value={startIndex}
            onChange={handleSetStartIndex}
            min="0"
            step="1"
          />
          <input
            className="w-32"
            type="number"
            value={endIndex}
            onChange={handleSetEndIndex}
            min="1"
            step="1"
          />
          <Button label="Start Scan" onClick={handleScan} rounded="md" />
        </div>
        <div>
          <input
            type="number"
            value={nScanMore}
            onChange={handleSetNScanMore}
          />
          <Button label="Scan More" rounded="md" onClick={handleScanMore} />
        </div>
        <ul>
          <li>Receive Addresses: {receiveAddresses.length}</li>
          <li>
            Used Receive Addresses:{" "}
            {receiveAddresses.length - unusedReceiveAddresses.length}
          </li>
          <li>Unused Receive Addresses: {unusedReceiveAddresses.length}</li>
        </ul>
        <ul>
          <li>Change Addresses: {changeAddresses.length}</li>
          <li>
            Used Change Addresses:{" "}
            {changeAddresses.length - unusedChangeAddresses.length}
          </li>
          <li>Unused Change Addresses: {unusedChangeAddresses.length}</li>
        </ul>
      </div>
      {foundPath !== "" && <div>Found addresses on {foundPath}</div>}
      {scanCount !== 0 && <div>Scanned {scanCount} addresses</div>}
      <AssetsViewAddresses />
    </>
  );
}

import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router";
import { CloseOutlined, CopyOutlined } from "@ant-design/icons";
import { WalletConnectFilled } from "@/icons/WalletConnectFilled";

import { selectActiveWalletHash } from "@/redux/wallet";
import {
  selectWcSessions,
  wcSessionDelete,
  wcSessionReject,
} from "@/redux/walletConnect";

import LogService from "@/kernel/app/LogService";
import WalletConnectService from "@/kernel/bch/WalletConnectService";
import AddressManagerService from "@/kernel/wallet/AddressManagerService";

import translations from "@/views/wallet/translations";
import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";
import Address from "@/atoms/Address";
import Button from "@/atoms/Button";

import { useClipboard } from "@/hooks/useClipboard";

import { convertCashAddress } from "@/util/cashaddr";

import { translate } from "@/util/translations";

const Log = LogService("AppWalletConnectView");

export default function AppWalletConnectView() {
  const dispatch = useDispatch();
  const location = useLocation();

  const { handleCopyToClipboard } = useClipboard();

  const [tokenToggle, setTokenToggle] = useState(0);

  const [walletConnectUri, setWalletConnectUri] = useState(
    location.state?.wcUri
  );

  const sessions = useSelector(selectWcSessions);

  const WalletConnect = WalletConnectService();

  const handlePair = async (e) => {
    e.preventDefault();

    Log.debug(walletConnectUri);
    await WalletConnect.pair({ uri: walletConnectUri });

    setWalletConnectUri("");
  };

  const handleReject = async (sessionId) => {
    dispatch(wcSessionReject(sessionId));
  };

  const handleDeleteSession = async (sessionId) => {
    dispatch(wcSessionDelete(sessionId));
  };

  const walletHash = useSelector(selectActiveWalletHash);
  const walletConnectAddress = useMemo(() => {
    const AddressManager = AddressManagerService(walletHash);
    const { address } = AddressManager.getWalletConnectAddress();
    const tokenAddress = convertCashAddress(address, "tokenaddr");

    return [address, tokenAddress];
  }, [walletHash]);

  const handleCopyWalletConnectAddress = () => {
    handleCopyToClipboard(
      walletConnectAddress[tokenToggle],
      walletConnectAddress[tokenToggle]
    );
  };

  return (
    <FullColumn>
      <ViewHeader title="WalletConnect" icon={WalletConnectFilled} />
      <div className="p-1 bg-primary-900 text-neutral-50">
        <div className="flex justify-between items-center">
          <div className="px-1 font-bold flex items-center">
            <WalletConnectFilled className="mr-1" />
            {translate(translations.walletConnectAddress)}
          </div>
          <label className="px-1 flex items-center">
            <input
              type="checkbox"
              checked={tokenToggle === 1}
              onChange={(event) => setTokenToggle(event.target.checked ? 1 : 0)}
              className="mr-1"
            />
            <span className="text-sm">
              {translate(translations.useTokenAddress)}
            </span>
          </label>
        </div>
        <Button
          icon={CopyOutlined}
          iconSize="md"
          labelColor="text-primary-700"
          label={
            <Address
              address={walletConnectAddress[tokenToggle]}
              className="font-mono tracking-tighter"
              color="a" // non-empty string just to work w/ dark mode over a Button
            />
          }
          onClick={handleCopyWalletConnectAddress}
          rounded="md"
          padding="2"
          fullWidth
          className="my-1"
        />
      </div>
      <form onSubmit={handlePair} className="p-2 flex items-center">
        <input
          type="text"
          className="p-1 w-full border-2 rounded border-primary mr-2 dark:bg-neutral-700 text-primary dark:text-neutral-25"
          value={walletConnectUri}
          onChange={(e) => setWalletConnectUri(e.target.value)}
        />
        <Button label="Pair" submit />
      </form>
      <div className="p-1">
        {Object.keys(sessions).map((key) => {
          const session = sessions[key];
          const peer = session.peer.metadata;
          const address = session.namespaces.bch.accounts[0].slice(4);

          return (
            <div key={key}>
              <div className="p-1 dark:text-neutral-100 border border-neutral-600 rounded">
                <div className="flex">
                  <div className="flex items-center justify-center p-1 border border-neutral-500 dark:border-primarydark-500 w-16 h-16">
                    <img src={peer.icons[0]} className="w-full h-full" />
                  </div>
                  <div className="flex flex-col px-1 w-full">
                    <div className="font-bold">{peer.name}</div>
                    <div className="font-mono text-sm">{peer.url}</div>
                    <div>{peer.description}</div>
                  </div>
                  <div className="shrink mr-1 flex items-center justify-center">
                    <Button
                      icon={CloseOutlined}
                      iconSize="xl"
                      padding="2"
                      onClick={() => handleDeleteSession(key)}
                    />
                  </div>
                </div>
                <div className="font-mono text-sm tracking-tighter">
                  <Address address={address} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </FullColumn>
  );
}

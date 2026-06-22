import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { ArrowLeftOutlined, SyncOutlined } from "@ant-design/icons";

import { selectBchNetwork, selectIsOfflineMode } from "@/redux/preferences";
import { selectSyncState } from "@/redux/sync";
import { selectActiveWalletHash } from "@/redux/wallet";

import LogService from "@/kernel/app/LogService";
import NotificationService from "@/kernel/app/NotificationService";
import ElectrumService from "@/kernel/bch/ElectrumService";
import { buildSweepTransaction } from "@/kernel/bch/TransactionBuilderService";
import TransactionManagerService from "@/kernel/bch/TransactionManagerService";
import AddressManagerService from "@/kernel/wallet/AddressManagerService";
import type { UtxoEntity } from "@/kernel/wallet/UtxoManagerService";

import translations from "@/views/wallet/translations";
import Address from "@/atoms/Address";
import Button from "@/atoms/Button";
import CurrencyFlip from "@/atoms/CurrencyFlip";
import Satoshi from "@/atoms/Satoshi";

import { useCurrencyFlip } from "@/hooks/useCurrencyFlip";

import { Haptic } from "@/util/haptic";
import { validateWifUri } from "@/util/uri";

import { translate } from "@/util/translations";

const Log = LogService("WalletViewSweep");

export default function WalletViewSweep() {
  const params = useParams();
  const navigate = useNavigate();

  const walletHash = useSelector(selectActiveWalletHash);
  const sync = useSelector(selectSyncState);
  const isOfflineMode = useSelector(selectIsOfflineMode);
  const bchNetwork = useSelector(selectBchNetwork);

  // Reload unused addresses when wallet data changes
  const unusedAddresses =
    AddressManagerService(walletHash).getUnusedAddresses();

  // Get the receiving address to use.
  const receivingAddress = unusedAddresses[0]?.address || "";

  // Set our state.
  const [isFetchingUtxos, setIsFetchingUtxos] = useState(true);
  const [isSweeping, setIsSweeping] = useState(false);
  const [message, setMessage] = useState("");
  const [utxos, setUtxos] = useState<Array<UtxoEntity>>([]);
  const [isSweepable, setIsSweepable] = useState(false);

  const handleFlipCurrency = useCurrencyFlip();

  // Throw an error if no WIF was provided as a URL param to this route.
  if (!params.wif) {
    throw new Error('No "wif" param specified in route');
  }

  // Validate the WIF provided is valid.
  const { address: wifAddress, privateKey, wif } = validateWifUri(params.wif);

  // Throw an error if the WIF is invalid.
  if (!wifAddress) {
    throw new Error(`Invalid WIF provided (${params.wif})`);
  }

  // Run when Electrum's connectivity state changes.
  // NOTE: This is to prevent a race-condition whereby a user can land on this page prior to Electrum being connected.
  //       The intent is to allow Selene to be invoked by a "bch-wif:${wif}" URL and "wait" for connection before making the requestUTXO's call.
  useEffect(() => {
    const requestUtxos = async () => {
      if (isOfflineMode) {
        NotificationService().disconnected();
        navigate("/");
        return;
      }

      // Fetch the UTXOs from our Electrum Service.
      const electrumUtxos =
        await ElectrumService(bchNetwork).requestUtxos(wifAddress);

      // Check if the response is an instance of Error (because Electrum Requests do not "throw" errors, they return them).
      if (utxos instanceof Error) {
        throw utxos;
      }

      // Set the UTXOs.
      setUtxos(electrumUtxos);
      setIsFetchingUtxos(false);
    };

    if (sync.isConnected && isFetchingUtxos) {
      requestUtxos();
    }
  }, [
    sync.isConnected,
    isFetchingUtxos,
    utxos,
    wifAddress,
    isOfflineMode,
    navigate,
    bchNetwork,
  ]);

  // Calculate the satoshi balance when our UTXOs change.
  const wifSatoshiBalance = useMemo(() => {
    return utxos.reduce((total, utxo) => total + utxo.valueSatoshis, 0n);
  }, [utxos]);

  // Determine whether the WIF contains tokens so that we can display an unsupported message.
  // NOTE: This will not be functional until our Electrum Protocol uses >= V1.5.
  //       For Electrum Protocol < V1.5 UTXOs containing tokens will just be ignored (not swept).
  const didWifContainTokens = useMemo(() => {
    return utxos.some((utxo) => utxo.token_category);
  }, [utxos]);

  // Set message based on WIF state (empty or contains tokens).
  useEffect(() => {
    if (isFetchingUtxos) {
      setMessage("");
    }

    // If the WIF is empty, set the wallet to unsweepable and show a message.
    else if (!wifSatoshiBalance) {
      const emptyWifTranslation = translate(translations.emptyWif);
      setMessage(emptyWifTranslation);
      setIsSweepable(false);
    }

    // If the WIF contains tokens, set the wallet to unsweepable and show a message.
    else if (didWifContainTokens) {
      const wifContainsTokensTranslation = translate(
        translations.wifContainsTokens
      );
      setMessage(wifContainsTokensTranslation);
      setIsSweepable(false);
    } else {
      setMessage("");
      setIsSweepable(true);
    }
  }, [isFetchingUtxos, wifSatoshiBalance, didWifContainTokens]);

  const confirmSweep = async () => {
    if (isSweeping) {
      return;
    }

    setIsSweeping(true);

    if (!sync.isConnected) {
      NotificationService().disconnected();
      setIsSweeping(false);
      return;
    }

    try {
      // Get instances of TransactionManager.
      const TransactionManager = TransactionManagerService();

      // Build the transaction to sweep the WIF.
      const transaction = buildSweepTransaction(
        utxos,
        privateKey,
        receivingAddress
      );

      // Broadcast and register locally.
      const tx = await TransactionManager.sendTransaction(
        transaction,
        bchNetwork
      );

      // Show a notification.
      await Haptic.success();

      // Update blockhash/height when confirmed
      TransactionManager.resolveTransaction(tx.tx_hash, bchNetwork).catch((e) =>
        Log.warn("resolveTransaction failed", tx.tx_hash, e)
      );

      // Navigate to the "Sweep Successful" page.
      navigate("/wallet/send/success", {
        state: {
          tx_hash: tx.tx_hash,
          tx,
          header: translate(translations.walletSwept),
        },
        replace: true,
      });
    } catch (error) {
      await Haptic.error();
      Log.warn(`Sweeping from ${wif} failed: ${error}`);
      setMessage(translate(translations.sweepingFailed));
    } finally {
      setIsSweeping(false);
    }
  };

  return (
    <div className="flex flex-col justify-start h-full">
      <div className="tracking-wide text-center text-white">
        {message !== "" ? (
          <div data-testid="sweep-error" className="bg-error p-2">
            <div className="text-xl font-bold">{message}</div>
          </div>
        ) : (
          <div className="bg-primary px-2 py-1">
            <div className="text-lg font-bold">
              {translate(translations.sweepingFrom)}
            </div>
            <div className="text-sm py-1 font-mono tracking-tight">
              <div>{wif}</div>
              (<Address address={wifAddress} />)
            </div>
          </div>
        )}
      </div>

      {isFetchingUtxos || isSweeping ? (
        <div className="mb-32 flex items-center justify-center w-full h-full text-center">
          <SyncOutlined className="text-7xl" spin />
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex flex-col mx-2 justify-center h-full">
            <div className="bg-primary/80 text-neutral-900 rounded-md p-4">
              <div
                className="p-4 text-center bg-neutral-100 rounded-md cursor-pointer"
                onClick={handleFlipCurrency}
              >
                <div className="font-semibold text-xl mb-1 text-neutral-900">
                  <Satoshi value={wifSatoshiBalance} />
                </div>
                <div className="text-lg flex items-center justify-center gap-x-2 text-neutral-800">
                  <Satoshi value={wifSatoshiBalance} flip />
                  <CurrencyFlip className="text-xl" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-end shrink my-6">
            <div className="flex w-full justify-around items-center px-2 gap-x-2">
              <div className="mx-2">
                <Button
                  icon={ArrowLeftOutlined}
                  iconSize="lg"
                  label={translate(translations.back)}
                  onClick={() => navigate(-1)}
                />
              </div>
              <div className="flex-1">
                <span className="font-bold">
                  <Button
                    label={translate(translations.confirm)}
                    inverted
                    fullWidth
                    onClick={() => confirmSweep()}
                    disabled={!isSweepable}
                  />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

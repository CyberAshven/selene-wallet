/* eslint-disable max-classes-per-file */
import {
  ConnectionStatus,
  ElectrumClient,
  ElectrumClientEvents,
} from "@electrum-cash/network";
import { ElectrumWebSocket } from "@electrum-cash/web-socket";

import { store } from "@/redux";
import { setPreference } from "@/redux/preferences";
import {
  selectChaintip,
  syncAddressState,
  syncChaintip,
  syncConnectionDown,
  syncConnectionUp,
} from "@/redux/sync";

import LogService from "@/kernel/app/LogService";
import BlockchainService from "@/kernel/bch/BlockchainService";
import type { NormalizedTransaction } from "@/kernel/bch/TransactionManagerService";
import { AddressEntity } from "@/kernel/wallet/AddressManagerService";
import type { UtxoEntity } from "@/kernel/wallet/UtxoManagerService";

import {
  electrum_servers,
  ElectrumServer,
  ValidBchNetwork,
} from "@/util/network";

export type ElectrumUtxo = {
  height: number;
  token_data?: {
    amount: string;
    category: string;
    nft?: { capability: string; commitment: string };
  };
  tx_hash: string;
  tx_pos: number;
  value: number;
};

export type ElectrumHistoryEntry = {
  tx_hash: string;
  height: number;
  fee?: number;
};

export type ElectrumVerboseTransaction = {
  txid: string;
  hash: string;
  hex: string;
  size: number;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    scriptSig: { asm: string; hex: string };
    sequence: number;
    coinbase?: string;
  }>;
  vout: Array<{
    value: number;
    n: number;
    scriptPubKey: {
      addresses?: string[];
      hex: string;
      asm: string;
      type?: string;
    };
  }>;
  blockhash?: string;
  blocktime?: number;
  time?: number;
  confirmations?: number;
};

export type ElectrumMerkleProof = {
  pos: number;
  merkle: string[];
  block_height: number;
};

export type ElectrumUtxoInfo = {
  confirmed_height: number;
  scripthash: string;
  value: number;
};

export type ElectrumBlockHeader = {
  hex: string;
  height: number;
};

const Log = LogService("Electrum");

export class ElectrumNotConnectedError extends Error {
  constructor() {
    super(`ElectrumNotConnectedError`);
  }
}

export class ElectrumVersionMismatchError extends Error {}

export const ELECTRUM_PROTOCOL_VERSION = "1.5";
export const ROSTRUM_PROTOCOL_VERSION = "1.4.3";

// pointer for current ElectrumClient instance
const electrum_handles = new Map<
  string,
  ElectrumClient<ElectrumClientEvents> | null
>();

const server_blacklist: Array<string> = [];
const pendingTxRequests: Map<string, Promise<object>> = new Map();

function normalizeTransaction(
  tx: ElectrumVerboseTransaction & { height: number }
): NormalizedTransaction {
  return {
    // Electrum verbose tx uses `txid` for the transaction hash, but our normalized name is `tx_hash`
    tx_hash: tx.txid,
    hex: tx.hex,
    size: tx.size,
    blockhash: tx.blockhash ?? null,
    blocktime: tx.blocktime ?? null,
    time: tx.time ?? null,
    version: tx.version,
    height: tx.height,
    coinbase: tx.vin[0]?.coinbase ?? null,
  };
}

function normalizeUtxo(address: string, u: ElectrumUtxo): UtxoEntity {
  return {
    address,
    tx_hash: u.tx_hash,
    tx_pos: u.tx_pos,
    valueSatoshis: BigInt(u.value),
    memo: null,
    token_category: u.token_data?.category ?? null,
    token_amount: u.token_data ? BigInt(u.token_data.amount) : null,
    nft_capability: u.token_data?.nft?.capability ?? null,
    nft_commitment: u.token_data?.nft?.commitment ?? null,
  };
}

interface WithListenersI {
  connected: () => void;
  notification: (data: unknown) => void;
  disconnected: () => void;
}

// ElectrumService: brokers interactions with electrum server
export default function ElectrumService(
  bchNetwork: ValidBchNetwork | "cauldron" = "mainnet"
) {
  return {
    connect,
    disconnect,
    getIsConnected,
    subscribeToAddress,
    subscribeToChaintip,
    //requestBalance,
    requestAddressState,
    requestAddressHistory,
    requestUtxos,
    requestUtxoInfo,
    requestTransaction,
    requestMerkle,
    requestBlockHeader,
    requestBlock,
    broadcastTransaction,
    //requestRelayFee,
    selectFallbackServer,
    getElectrumHost,
    getElectrumClient,
    getElectrumHandle,
  };

  // connect: connect to an Electrum server
  // Creates a new ElectrumClient every time
  async function connect(server?: string, withListeners?: WithListenersI) {
    const server_list = electrum_servers[bchNetwork];

    const connectServer = server || server_list[0];

    Log.log("Connecting to", connectServer, bchNetwork);

    // force disconnect old electrum object to ensure all handlers are cleared
    await disconnect(true);

    // explicitly nullify electrum handle to prompt garbage collection
    electrum_handles.set(bchNetwork, null);

    // pre-configure the Electrum socket
    const parts = ElectrumServer.toParts(connectServer);
    const socket = new ElectrumWebSocket(parts.host, parts.port, true, 17500);

    const protocolVersion =
      bchNetwork === "cauldron"
        ? ROSTRUM_PROTOCOL_VERSION
        : ELECTRUM_PROTOCOL_VERSION;

    // create a new ElectrumClient every time to enable server switching
    const electrum = new ElectrumClient(
      "Selene.cash",
      protocolVersion,
      socket,
      { disableBrowserVisibilityHandling: true }
    );

    electrum_handles.set(bchNetwork, electrum);

    // need to establish listeners every time we recreate the ElectrumClient
    electrum.addListener("connected", () => {
      Log.log("ELECTRUM CONNECTED", connectServer, bchNetwork);
      if (withListeners && typeof withListeners.connected === "function") {
        withListeners.connected();
      } else {
        store.dispatch(syncConnectionUp());
      }
    });

    electrum.addListener("notification", (data) => {
      if (withListeners && typeof withListeners.notification === "function") {
        withListeners.notification(data);
      } else {
        handleElectrumNotifications(data);
      }
    });

    electrum.addListener("disconnected", () => {
      Log.log("ELECTRUM DISCONNECTED", bchNetwork);
      if (withListeners && typeof withListeners.disconnected === "function") {
        withListeners.disconnected();
      } else {
        store.dispatch(syncConnectionDown());
      }
    });

    electrum.addListener("connecting", () => {
      Log.debug(bchNetwork, "connecting...");
    });

    electrum.addListener("reconnecting", () => {
      Log.debug(bchNetwork, "reconnecting...");
    });

    electrum.addListener("disconnecting", () => {
      Log.debug(bchNetwork, "disconnecting...");
    });

    electrum.addListener("error", handleElectrumError);

    try {
      await electrum.connect();
      return true;
    } catch (e) {
      const isProtocolVersionMismatch = `${e}`.includes(
        ELECTRUM_PROTOCOL_VERSION
      );

      if (isProtocolVersionMismatch) {
        throw new ElectrumVersionMismatchError();
      }

      Log.error(e);
      throw new Error(`Connection to ${server} failed. ${e}`);
    }
  }

  // disconnect: disconnect the Electrum instance
  async function disconnect(force: boolean) {
    const electrum = getElectrumHandle();
    if (electrum) {
      Log.debug("electrum disconnect");
      return electrum.disconnect(force);
    }

    return true;
  }

  function getIsConnected() {
    const electrum = getElectrumHandle();
    return electrum ? electrum.status === ConnectionStatus.CONNECTED : false;
  }

  // subscribeToAddress: listen for updates on an address
  async function subscribeToAddress(address: AddressEntity): Promise<void> {
    const electrum = getElectrumHandle();
    if (!electrum || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }

    //Log.debug("subscribeToAddress", address.address);

    // use `request` instead of `subscribe`
    // this bypasses electrum-cash's subscription management
    // otherwise we end up sending 2 requests per subscription
    const result = await electrum.request(
      "blockchain.address.subscribe",
      address.address
    );

    // manually emit initial notification
    handleElectrumNotifications({
      method: "blockchain.address.subscribe",
      params: [address.address, result],
    });
  }

  async function subscribeToChaintip(): Promise<void> {
    const electrum = getElectrumHandle();
    if (!electrum || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }

    // use `request` instead of `subscribe`
    // this bypasses electrum-cash's subscription management
    // otherwise we end up sending 2 requests per subscription
    const result = await electrum.request("blockchain.headers.subscribe");

    // manually emit initial notification
    handleElectrumNotifications({
      method: "blockchain.headers.subscribe",
      params: [result],
    });
  }

  // request the most up-to-date balance information for an address
  /*
  // this function isn't actually used, so prune it from distribution by commenting for now
  async function requestBalance(address: string) {
    if (electrum === null || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }

    const result = await electrum.request(
      "blockchain.address.get_balance",
      address
    );

    if (result instanceof Error) {
      throw result;
    }

    const { confirmed, unconfirmed } = result;

    return confirmed + unconfirmed;
  }
  */

  // request the most up-to-date state hash for an address
  async function requestAddressState(address: string) {
    const electrum = getElectrumHandle();
    if (!electrum || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }

    const addressState = await electrum.request(
      "blockchain.address.subscribe",
      address
    );

    if (addressState instanceof Error) {
      throw addressState;
    }

    return addressState as string;
  }

  // request the entire transaction history for an address
  async function requestAddressHistory(
    address: string,
    startHeight: number = 0,
    endHeight: number = -1
  ): Promise<ElectrumHistoryEntry[]> {
    const electrum = getElectrumHandle();
    if (!electrum || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }

    const history = await electrum.request(
      "blockchain.address.get_history",
      address,
      startHeight,
      endHeight
    );

    if (history instanceof Error) {
      throw history;
    }

    return history as ElectrumHistoryEntry[];
  }

  // request all current UTXOs for an address
  async function requestUtxos(address: string): Promise<UtxoEntity[]> {
    const electrum = getElectrumHandle();
    if (!electrum || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }

    const utxos = await electrum.request(
      "blockchain.address.listunspent",
      address
    );

    if (utxos instanceof Error) {
      throw utxos;
    }

    return (utxos as ElectrumUtxo[]).map((u) => normalizeUtxo(address, u));
  }

  async function requestUtxoInfo(
    tx_hash: string,
    tx_pos: number
  ): Promise<ElectrumUtxoInfo | null> {
    const electrum = getElectrumHandle();
    if (!electrum || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }

    const utxoInfo = await electrum.request(
      "blockchain.utxo.get_info",
      tx_hash,
      tx_pos
    );

    if (utxoInfo instanceof Error) throw utxoInfo;
    return utxoInfo as ElectrumUtxoInfo | null;
  }

  // request a transaction by its txid
  async function requestTransaction(
    tx_hash: string
  ): Promise<NormalizedTransaction> {
    const electrum = getElectrumHandle();
    if (!electrum || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }

    // de-duplicate transaction requests
    const pending = pendingTxRequests.get(tx_hash);
    if (pending) {
      Log.warn("waiting on resolution for", tx_hash);
      return pending as Promise<NormalizedTransaction>;
    }

    const txRequest = electrum
      .request("blockchain.transaction.get", tx_hash, true)
      .then((tx) => {
        //Log.debug(tx);
        if (tx instanceof Error) {
          throw tx;
        }
        // [Kludge?] I don't like accessing redux here but not certain SQL chaintip is reliable
        const chaintip = selectChaintip(store.getState());
        const height = tx.confirmations
          ? chaintip.height - tx.confirmations + 1
          : 0;

        //Log.debug("height", height, tx_hash, tx.confirmations);

        pendingTxRequests.delete(tx_hash);
        return normalizeTransaction({ ...tx, height });
      })
      .catch((e) => {
        pendingTxRequests.delete(tx_hash);
        Log.error("txRequest failed", e);
        throw e;
      });

    pendingTxRequests.set(tx_hash, txRequest);

    return txRequest as Promise<NormalizedTransaction>;
  }

  // requestMerkle: request merkle proof for a transaction
  async function requestMerkle(
    tx_hash: string,
    height: number
  ): Promise<ElectrumMerkleProof> {
    const electrum = getElectrumHandle();
    if (!electrum || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }

    const merkle = await electrum.request(
      "blockchain.transaction.get_merkle",
      tx_hash,
      height
    );

    return merkle as ElectrumMerkleProof;
  }

  // requestBlockHeader: request a block by height
  async function requestBlockHeader(
    height: number,
    checkpoint_height: number = 0
  ): Promise<string> {
    if (height < 0 || checkpoint_height < 0) {
      throw new Error("height must be non-negative integer");
    }

    const electrum = getElectrumHandle();
    if (!electrum || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }

    const header = await electrum.request(
      "blockchain.block.header",
      height,
      checkpoint_height
    );

    if (header instanceof Error) {
      throw header;
    }

    Log.debug("requestBlockHeader", header, height);
    return header as string;
  }

  // requestBlock: request a block by height or hash
  async function requestBlock(
    blockhashOrHeight: string | number
  ): Promise<ElectrumBlockHeader & { blockhash: string }> {
    const electrum = getElectrumHandle();
    if (!electrum) {
      throw new ElectrumNotConnectedError();
    }

    const block = await electrum.request(
      "blockchain.header.get",
      blockhashOrHeight
    );

    if (typeof block !== "object" || block instanceof Error) {
      throw block;
    }

    const blockhash = BlockchainService(bchNetwork).calculateBlockhash(
      block.hex
    );

    Log.debug("requestBlock", block, blockhash);
    return { ...block, blockhash };
  }

  async function broadcastTransaction(tx_hex): Promise<string> {
    const electrum = getElectrumHandle();
    if (!electrum) {
      throw new ElectrumNotConnectedError();
    }

    const tx_hash = await electrum.request(
      "blockchain.transaction.broadcast",
      tx_hex
    );

    if (typeof tx_hash !== "string") {
      throw new Error(tx_hash?.toString());
    }

    Log.log("broadcastTransaction", tx_hash, tx_hex);
    return tx_hash;
  }

  /*
  // unused, prune from dist
  async function requestRelayFee() {
    if (electrum === null || electrum.status !== ConnectionStatus.CONNECTED) {
      throw new ElectrumNotConnectedError();
    }
    const result = await electrum.request("blockchain.relayfee");

    if (result instanceof Error) {
      throw error;
    }

    const relayFee = bchToSats(result);
    return relayFee;
  }
  */

  function selectFallbackServer(prevServer): string {
    const server_list = electrum_servers[bchNetwork];

    // don't blacklist the known-good Selene-operated server
    if (prevServer && prevServer !== server_list[0]) {
      server_blacklist.push(prevServer);
    }

    const filtered_server_list = server_list.filter(
      (s) => !server_blacklist.includes(s)
    );

    const chooseRandomServer = () => {
      return filtered_server_list[
        Math.floor(Math.random() * filtered_server_list.length)
      ];
    };

    const newServer = chooseRandomServer();

    // only overwrite user server preference on mainnet
    if (bchNetwork === "mainnet") {
      store.dispatch(
        setPreference({
          key: "electrumServer",
          value: newServer,
        })
      );
    }

    Log.log(
      "selectFallbackServer",
      newServer,
      prevServer,
      server_blacklist,
      bchNetwork
    );

    return newServer;
  }

  function getElectrumHost(): string {
    const electrum = getElectrumHandle();
    return electrum ? electrum.hostIdentifier : "";
  }

  function getElectrumClient() {
    const electrum = getElectrumHandle();
    if (!electrum) {
      throw new ElectrumNotConnectedError();
    }

    return electrum;
  }

  function getElectrumHandle(network?) {
    const networkHandle = network || bchNetwork;
    return electrum_handles.get(networkHandle);
  }
}

function handleElectrumNotifications(data) {
  if (data.method === "blockchain.address.subscribe") {
    store.dispatch(syncAddressState(data.params));
  }

  if (data.method === "blockchain.headers.subscribe") {
    handleChaintipSubscription(data.params);
  }
}

function handleElectrumError(error) {
  Log.warn(error);
}

function handleChaintipSubscription(data) {
  if (!Array.isArray(data)) {
    return;
  }

  const chaintip = data[0];
  store.dispatch(syncChaintip(chaintip));
}

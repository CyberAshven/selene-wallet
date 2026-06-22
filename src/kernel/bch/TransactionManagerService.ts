import { Directory, Filesystem } from "@capacitor/filesystem";
import {
  assertSuccess,
  decodeTransaction,
  disassembleBytecodeBCH,
  Input as LibauthInput,
  lockingBytecodeToCashAddress,
  Output as LibauthOutput,
  TransactionCommon,
} from "@bitauth/libauth";

import DatabaseService from "@/kernel/app/DatabaseService";
import LogService from "@/kernel/app/LogService";
import ElectrumService from "@/kernel/bch/ElectrumService";
import AddressManagerService from "@/kernel/wallet/AddressManagerService";
import UtxoManagerService from "@/kernel/wallet/UtxoManagerService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import { binToHex, hexToBin } from "@/util/hex";
import { ValidBchNetwork } from "@/util/network";

const Log = LogService("TransactionManager");

export interface TransactionStub {
  tx_hash: string;
  hex: string;
}

export interface NormalizedTransaction extends TransactionStub {
  size?: number;
  blockhash?: string | null;
  blocktime?: number | null;
  time?: number | null;
  version?: number;
  height?: number | null; // null = broadcast; 0 = in mempool; >0 = confirmed
  coinbase?: string | null;
}

export interface TransactionEntity extends TransactionStub {
  blockhash: string | null;
  blocktime: number;
  time: number;
  size: number;
  version: number;
  height: number | null; // null = broadcast, not verified; 0 = in mempool; >0 = confirmed
  vin: Array<TransactionInput>;
  vout: Array<TransactionOutput>;
}

export interface TransactionInput extends LibauthInput {
  tx_hash: string;
  vout: number;
  coinbase?: string;
}

export interface VoutScriptPubKey {
  addresses?: Array<string>;
  hex: string;
  asm: string;
}

export interface TransactionOutput extends LibauthOutput {
  n: number;
  scriptPubKey: VoutScriptPubKey;
}

export class TransactionNotExistsError extends Error {
  constructor(tx_hash: string) {
    super(`No Transaction with id ${tx_hash}`);
  }
}

export default function TransactionManagerService() {
  const Database = DatabaseService();
  const APP_DB = Database.getAppDatabase();

  const WalletManager = WalletManagerService();

  return {
    resolveTransaction,
    waitForTransactionToResolve,
    sendTransaction,
    registerTransaction,
    deleteTransaction,
    purgeTransactions,
    getUnresolvedTransactions,
    rebroadcastUnresolved,
    setBlockPos,
    setBlockPosBulk,
    applyOptimisticUtxoUpdate,
  };

  // --------------------------------

  // resolveTransaction: load transaction from db, fetch it from electrum if we don't have it
  async function resolveTransaction(
    tx_hash: string,
    network: ValidBchNetwork = "mainnet"
  ): Promise<TransactionEntity> {
    try {
      const localTx = await getTransactionByHash(tx_hash);

      // request the tx again if it's unconfirmed
      if (localTx.blockhash === null || localTx.height <= 0) {
        throw new Error("Transaction Unconfirmed");
      }

      Log.debug("resolveTransaction", "local hit", tx_hash);
      return localTx;
    } catch (e) {
      // if there's any problem retrieving the tx locally, try to resolve it
      Log.debug("resolveTransaction", "fetching remote", tx_hash, e);
      const Electrum = ElectrumService(network);
      const remoteTx = await Electrum.requestTransaction(tx_hash);
      Log.debug("resolveTransaction", "remote fetched", tx_hash);
      const registeredTx = await registerTransaction(remoteTx);
      Log.debug("resolveTransaction", "registered", tx_hash);
      return registeredTx;
    }
  }

  // Will poll resolveTransaction at the given interval for up to the given timeout period.
  // This function is useful in situations where we need to monitor ("wait") for a transaction that is broadcasted by a third-party node (not us).
  // NOTE: A more optimal implementation in future might be to use Fulcrum's tx.subscribe emthods.
  //       However, this would probably be a heavy refactor that introduces additional state.
  async function waitForTransactionToResolve(
    transactionId: string,
    timeoutMs = 10_000,
    intervalMs = 1000
  ) {
    const startTime = Date.now();

    return new Promise<TransactionEntity>((resolve, reject) => {
      const checkTransaction = async () => {
        try {
          const tx = await resolveTransaction(transactionId);
          resolve(tx);
        } catch (error) {
          // If the transaction is not resolved yet, check again after the interval
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime < timeoutMs) {
            setTimeout(checkTransaction, intervalMs);
          } else {
            reject(
              new Error(`Failed to resolve transaction after ${timeoutMs}ms`)
            );
          }
        }
      };

      // Start checking the transaction
      checkTransaction();
    });
  }

  // Broadcast via Electrum and register locally.
  async function sendTransaction(
    tx: TransactionStub,
    network: ValidBchNetwork = "mainnet"
  ): Promise<TransactionEntity> {
    const Electrum = ElectrumService(network);

    Log.debug("sendTransaction attempting broadcast");
    const result = await Electrum.broadcastTransaction(tx.hex);

    if (result !== tx.tx_hash) {
      Log.warn("transaction send failure", result);
      throw result;
    }

    const registeredTx = await registerTransaction(tx);

    // NOTE: Do NOT call applyOptimisticUtxoUpdate here.
    // Optimistic UTXO discard races the Electrum subscription sync,
    // causing scanUtxos to see an empty diff (spent inputs already
    // gone, change already registered). This breaks payment received
    // toasts and balance updates. Let the subscription sync handle it.

    return registeredTx;
  }

  async function deleteTransaction(tx_hash: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        path: `/selene/tx/${tx_hash}.raw`,
        directory: Directory.Cache,
      });
    } catch (e) {
      //Log.warn(e);
    }

    //Log.debug("deleteTransaction", tx_hash);
    APP_DB.run("DELETE FROM transactions WHERE tx_hash=?;", [tx_hash]);
  }

  async function purgeTransactions(): Promise<void> {
    const wallets = WalletManager.listWallets();

    // get list of tx_hashes associated with our utxos or history (for ALL wallets)
    const live_txids = (
      await Promise.all(
        wallets.map(async ({ walletHash }) => {
          const walletDb = await WalletManager.openWalletDatabase(walletHash);
          const utxo_txids = walletDb.exec("SELECT tx_hash FROM address_utxos");
          const history_txids = walletDb.exec(
            "SELECT tx_hash FROM address_transactions"
          );
          return [
            ...utxo_txids.map(({ tx_hash }) => tx_hash),
            ...history_txids.map(({ tx_hash }) => tx_hash),
          ];
        })
      )
    ).flat();

    const liveTxidSet = new Set(live_txids);

    // Find transaction records not in any wallet's live set
    const purgeHashes = APP_DB.exec("SELECT tx_hash FROM transactions")
      .map(({ tx_hash }) => tx_hash)
      .filter((hash) => !liveTxidSet.has(hash));

    // Find orphaned transaction files
    const purgeHashSet = new Set(purgeHashes);
    const fileTxHashes = (
      await Filesystem.readdir({
        path: "/selene/tx",
        directory: Directory.Cache,
      })
    ).files
      .map((file) => file.name.split(".")[0])
      .filter((hash) => !liveTxidSet.has(hash) && !purgeHashSet.has(hash));

    const tx_hashes = [...purgeHashes, ...fileTxHashes];

    Log.time("purgeTransactions");
    await Promise.all(tx_hashes.map((hash) => deleteTransaction(hash)));
    Log.debug("purgeTransactions", tx_hashes);
    Log.timeEnd("purgeTransactions");
  }

  // Returns tx_hashes of transactions we broadcast but haven't verified in the mempool yet.
  function getUnresolvedTransactions(): Array<string> {
    return APP_DB.exec(
      "SELECT tx_hash FROM transactions WHERE height IS NULL"
    ).map(({ tx_hash }) => tx_hash);
  }

  // Rebroadcast and re-resolve all unverified transactions.
  async function rebroadcastUnresolved(
    network: ValidBchNetwork = "mainnet"
  ): Promise<void> {
    const txHashes = getUnresolvedTransactions();
    if (txHashes.length === 0) return;

    Log.debug("rebroadcastUnresolved", txHashes);
    const Electrum = ElectrumService(network);

    await Promise.all(
      txHashes.map(async (tx_hash) => {
        try {
          const hex = await _loadTxData(tx_hash);
          await Electrum.broadcastTransaction(hex);
          await resolveTransaction(tx_hash, network);
        } catch (e) {
          Log.warn("rebroadcast failed", tx_hash, e);
        }
      })
    );
  }

  // --------------------------------

  // Raw transaction data is stored directly on the device filesystem
  // This prevents bloating the in-memory sqlite db and causing OOM errors

  // [private] _loadTxData: read raw transaction hex data from filesystem
  async function _loadTxData(tx_hash: string): Promise<string> {
    try {
      const txFile = await Filesystem.readFile({
        path: `/selene/tx/${tx_hash}.raw`,
        directory: Directory.Cache,
      });

      const txData = txFile.data.toString();

      if (txData === "") {
        throw new TransactionNotExistsError(tx_hash);
      }

      // Filesystem plugin gives us base64-encoded data
      const tx_hex = atob(txData);
      return tx_hex;
    } catch (e) {
      throw new TransactionNotExistsError(tx_hash);
    }
  }

  // [private] _writeTxData: write raw transaction hex data to filesystem
  async function _writeTxData(tx_hash: string, tx_hex: string) {
    // Filesystem plugin writes as raw bytes, but we must pass base64
    const data = btoa(tx_hex);

    const result = await Filesystem.writeFile({
      path: `/selene/tx/${tx_hash}.raw`,
      directory: Directory.Cache,
      recursive: true,
      data,
    });

    return result;
  }

  // --------------------------------

  async function registerTransaction(
    tx: NormalizedTransaction
  ): Promise<TransactionEntity> {
    const decodedTx = decodeTransaction(hexToBin(tx.hex));

    if (typeof decodedTx === "string") {
      throw new Error(decodedTx);
    }

    const result = APP_DB.exec(
      `INSERT INTO transactions (
        tx_hash,
        size,
        blockhash,
        time,
        blocktime,
        version,
        height,
        coinbase
      )
      VALUES ($tx_hash, $size, $blockhash, $time, $blocktime, $version, $height, $coinbase)
      ON CONFLICT DO
        UPDATE SET
          size=$size,
          blockhash=$blockhash,
          time=$time,
          blocktime=$blocktime,
          height=$height
      RETURNING *;
      `,
      {
        $tx_hash: tx.tx_hash,
        $size: tx.size ?? tx.hex.length / 2,
        $blockhash: tx.blockhash ?? null,
        $time: tx.time ?? null,
        $blocktime: tx.blocktime ?? null,
        $version: tx.version ?? 2,
        $height: tx.height ?? null,
        $coinbase: tx.coinbase ?? null,
      }
    )[0];

    await _writeTxData(tx.tx_hash, tx.hex);

    const vin = getVinFromDecodedTransaction(decodedTx);
    const vout = getVoutFromDecodedTransaction(decodedTx);

    if (tx.coinbase != null) {
      vin[0].coinbase = tx.coinbase;
    }

    const finalTx = { ...result, vin, vout };
    return finalTx;
  }

  // Optimistically update the UTXO set after a successful broadcast:
  // discard spent inputs and register change outputs that belong to our wallet.
  function applyOptimisticUtxoUpdate(
    walletHash: string,
    tx: TransactionEntity
  ): void {
    const UtxoManager = UtxoManagerService(walletHash);
    const AddressManager = AddressManagerService(walletHash);

    // Discard spent inputs
    tx.vin.forEach((input) => {
      UtxoManager.discardUtxo({
        tx_hash: input.tx_hash,
        tx_pos: input.vout,
      });
    });

    // Register change outputs (outputs that belong to our wallet)
    tx.vout.forEach((output) => {
      const outputAddress = output.scriptPubKey.addresses?.[0];
      if (!outputAddress) return;

      try {
        AddressManager.getAddress(outputAddress);
      } catch {
        return; // not our address (includes token z-prefix addresses)
      }

      UtxoManager.registerUtxo({
        address: outputAddress,
        tx_hash: tx.tx_hash,
        tx_pos: output.n,
        valueSatoshis: output.valueSatoshis,
        memo: null,
        token_category: output.token?.category
          ? binToHex(output.token.category)
          : null,
        token_amount: output.token?.amount ?? null,
        nft_capability: output.token?.nft?.capability ?? null,
        nft_commitment: output.token?.nft?.commitment
          ? binToHex(output.token.nft.commitment)
          : null,
      });
    });
  }

  async function getTransactionByHash(
    tx_hash: string
  ): Promise<TransactionEntity> {
    const result = APP_DB.exec("SELECT * FROM transactions WHERE tx_hash=?", [
      tx_hash,
    ]);

    if (result.length < 1) {
      throw new TransactionNotExistsError(tx_hash);
    }

    // reconstruct transaction from raw tx hex
    const localTx = result[0];
    localTx.hex = await _loadTxData(tx_hash);

    const decodedTx = assertSuccess(decodeTransaction(hexToBin(localTx.hex)));

    // reconstruct "vin" from raw hex
    const vin = getVinFromDecodedTransaction(decodedTx);

    // reconstruct "vout" from raw hex
    const vout = getVoutFromDecodedTransaction(decodedTx);

    if (localTx.coinbase !== null) {
      vin[0].coinbase = localTx.coinbase;
    }

    const tx = { ...localTx, vin, vout };

    //Log.log("getTransactionByHash", tx_hash, decodedTx, tx);
    return tx;
  }

  function getVinFromDecodedTransaction(
    decodedTx: TransactionCommon
  ): Array<TransactionInput> {
    return decodedTx.inputs.map((input) => ({
      tx_hash: binToHex(input.outpointTransactionHash),
      vout: input.outpointIndex,
      outpointIndex: input.outpointIndex,
      outpointTransactionHash: input.outpointTransactionHash,
      sequenceNumber: input.sequenceNumber,
      unlockingBytecode: input.unlockingBytecode,
    }));
  }

  function getVoutFromDecodedTransaction(
    decodedTx: TransactionCommon
  ): Array<TransactionOutput> {
    return decodedTx.outputs.map((output, n) => {
      const cashAddr = lockingBytecodeToCashAddress({
        prefix: WalletManager.getPrefix(),
        bytecode: output.lockingBytecode,
        tokenSupport: !!output.token,
      });

      const vout = {
        n,
        lockingBytecode: output.lockingBytecode,
        scriptPubKey: {
          addresses: [typeof cashAddr !== "string" ? cashAddr.address : ""],
          hex: binToHex(output.lockingBytecode),
          asm: disassembleBytecodeBCH(output.lockingBytecode),
        },
        token: output.token,
        valueSatoshis: output.valueSatoshis,
      };

      return vout;
    });
  }

  function setBlockPos(tx_hash: string, blockPos: number) {
    APP_DB.run("UPDATE transactions SET block_pos=? WHERE tx_hash=?", [
      blockPos,
      tx_hash,
    ]);
  }

  function setBlockPosBulk(transactions) {
    try {
      //Log.debug("setBlockPosBulk", transactions);
      const valid = transactions.filter((t) => t.block_pos !== null);
      // 3 params per row (2 for CASE WHEN, 1 for WHERE IN); SQLite limit is 999
      const BATCH_SIZE = 333;
      for (let i = 0; i < valid.length; i += BATCH_SIZE) {
        const batch = valid.slice(i, i + BATCH_SIZE);
        const setClauses = batch.map(() => "WHEN ? THEN ?").join(" ");
        const whereIn = batch.map(() => "?").join(", ");
        const params = [
          ...batch.flatMap((t) => [t.tx_hash, t.block_pos]),
          ...batch.map((t) => t.tx_hash),
        ];
        APP_DB.run(
          `UPDATE transactions SET block_pos = CASE tx_hash ${setClauses} END WHERE tx_hash IN (${whereIn});`,
          params
        );
      }
      //Log.debug("setBlockPosBulk done");
    } catch (e) {
      Log.error(e);
      throw e;
    }
  }
}

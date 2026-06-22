import DatabaseService from "@/kernel/app/DatabaseService";
import LogService from "@/kernel/app/LogService";
import TransactionManagerService from "@/kernel/bch/TransactionManagerService";

import { sha256 } from "@/util/hash";

const Log = LogService("AddressManager");

export interface AddressStub {
  address: string;
  hd_index: number;
  change: number;
  state: string | null;
}

export interface AddressEntity extends AddressStub {
  balance: bigint;
  memo: string;
}

export class AddressNotExistsError extends Error {
  constructor(address: string) {
    super(`No Address ${address}`);
  }
}

// AddressManagerService: handles most address-related operations
export default function AddressManagerService(walletHash: string) {
  //Log.debug("AddressManagerService", wallet);
  const Database = DatabaseService();
  const walletDb = Database.getWalletDatabase(walletHash);

  // ~10 days of blocks at ~144 blocks/day
  const RECENT_BLOCK_WINDOW = 1440;

  const normalizeAddress = (row): AddressEntity => ({
    ...row,
    hd_index: Number(row.hd_index),
    change: Number(row.change),
  });

  return {
    registerAddress,
    getAddress,
    getAddressRange,
    getReceiveAddresses,
    getChangeAddresses,
    getUnusedAddresses,
    getReusedAddresses,
    getRecentlyActiveAddresses,
    getWalletConnectAddress,
    getAddressTransactions,
    calculateAddressState,
    nullifyAddressState,
    registerTransaction,
    registerTransactions,
  };

  // --------------------------------

  // register an address into the database
  function registerAddress(
    address: string,
    hd_index: number,
    change: number = 0
  ): AddressEntity {
    //Log.debug(`registerAddress${change ? " change" : ""}`, hd_index, address);

    try {
      const result = walletDb.exec(
        `INSERT INTO addresses (
          address,
          hd_index,
          change
        )
        VALUES (?, ?, ?)
        RETURNING *;`,
        [address, hd_index, change],
        { useBigInt: true }
      )[0];

      //Log.debug("registerAddress", result);
      return normalizeAddress(result);
    } catch (e) {
      Log.error(e);
      throw e;
    }
  }

  function getAddress(address: string): AddressEntity {
    const result = walletDb.exec(
      "SELECT * FROM addresses WHERE address=?",
      [address],
      { useBigInt: true }
    );

    if (result.length < 1) {
      throw new AddressNotExistsError(address);
    }

    return normalizeAddress(result[0]);
  }

  function getAddressRange(
    startIndex: number = 0,
    endIndex: number = 20,
    change: number = 0
  ): Array<AddressEntity> {
    const result = walletDb.exec(
      `SELECT * FROM addresses
          WHERE hd_index >= ?
          AND hd_index <= ?
          AND change=?
        ;`,
      [startIndex, endIndex, change],
      { useBigInt: true }
    );

    //Log.debug("getAddressRange", startIndex, endIndex, result);

    return result.map(normalizeAddress);
  }

  // getReceiveAddresses: get all active receive addresses for this wallet
  // in DESCENDING order so we can get latest index with limit 1
  function getReceiveAddresses(limit: number = 0): Array<AddressEntity> {
    const result = walletDb.exec(
      `SELECT * FROM addresses
          WHERE change='0'
          ORDER BY hd_index DESC
          ${limit > 0 ? `LIMIT ${limit}` : ""}
        ;`,
      null,
      { useBigInt: true }
    );

    //Log.log("getReceiveAddresses", limit, result);
    return result.map(normalizeAddress);
  }

  // getChangeAddresses: get all active change addresses for this wallet
  // in DESCENDING order so we can get latest index with limit 1
  // NB: If you want first UNUSED change address,
  // instead use getUnusedAddress(limit, 1)
  function getChangeAddresses(limit: number = 0): Array<AddressEntity> {
    const result = walletDb.exec(
      `SELECT * FROM addresses
          WHERE change="1"
          ORDER BY hd_index DESC
          ${limit > 0 ? `LIMIT ${limit}` : ""}
        ;`,
      null,
      { useBigInt: true }
    );

    //Log.log("getChangeAddresses", limit, result);
    return result.map(normalizeAddress);
  }

  // getUnusedAddresess: get the lowest-index unused recv addresses for wallet
  // in ASCENDING order so wallet consumes lowest-index first
  function getUnusedAddresses(
    limit: number = 5,
    change: number = 0
  ): Array<AddressEntity> {
    const result = walletDb.exec(
      `SELECT * FROM addresses
          WHERE state IS NULL
          AND change=?
          ORDER BY hd_index ASC
          ${limit > 0 ? `LIMIT ${limit}` : ""}
        ;`,
      [change],
      { useBigInt: true }
    );

    //Log.debug("getUnusedAddress", limit, result);
    return result.map(normalizeAddress);
  }

  function getReusedAddresses(): Array<AddressEntity> {
    const result = walletDb.exec(
      `SELECT * FROM addresses a
        WHERE (
          SELECT COUNT(*) FROM address_transactions t
            WHERE t.address = a.address
        ) >= 3`,
      null,
      { useBigInt: true }
    );

    return result.map(normalizeAddress);
  }

  function getRecentlyActiveAddresses(tipHeight: number): Array<AddressEntity> {
    if (tipHeight <= 0) return [];
    try {
      const minHeight = tipHeight - RECENT_BLOCK_WINDOW;
      const result = walletDb.exec(
        `SELECT * FROM addresses a
          WHERE (
            SELECT MAX(height) FROM address_transactions t
              WHERE t.address = a.address
          ) >= ?`,
        [minHeight],
        { useBigInt: true }
      );

      return result.map(normalizeAddress);
    } catch (e) {
      Log.warn("getRecentlyActiveAddresses failed:", e);
      return [];
    }
  }

  function getWalletConnectAddress(): AddressEntity {
    const result = walletDb.exec(
      "SELECT * FROM addresses WHERE hd_index=0 AND change=0",
      null,
      { useBigInt: true }
    );

    if (result.length < 1) {
      throw new AddressNotExistsError("walletconnect");
    }

    return normalizeAddress(result[0]);
  }

  /*
   * TODO: maybe make this return recently-used addresses by time or blockheight instead
   *
  // getRecentAddresess: get the higest-index USED addresses for wallet
  // in DESCENDING order so wallet consumes most recent index first
  function getRecentAddresses(
    limit: number = 20,
    change: number = 0
  ): Array<AddressEntity> {
    const result = walletDb.exec(
      `SELECT * FROM addresses 
          WHERE state IS NOT NULL 
          AND change="${change}"
          ORDER BY hd_index DESC 
          ${limit ? `LIMIT ${limit}` : ""}
        ;`
    );

    //Log.debug("getRecentAddresses", limit, result);
    return result;
  }
  */

  function getAddressTransactions(address: string) {
    const toHistoryRow = (row) => ({
      ...row,
      height: Number(row.height),
      block_pos: row.block_pos != null ? Number(row.block_pos) : null,
    });

    const confirmed = walletDb
      .exec(
        `SELECT * FROM address_transactions
          WHERE address=?
          AND height > 0
          ORDER BY height ASC, block_pos ASC
        ;`,
        [address],
        { useBigInt: true }
      )
      .map(toHistoryRow);

    const unconfirmed = walletDb
      .exec(
        `SELECT * FROM address_transactions
          WHERE address=?
          AND height <= 0
        ;`,
        [address],
        { useBigInt: true }
      )
      .map(toHistoryRow);

    //Log.log("getAddressTransactions", confirmed, unconfirmed, address);
    return { confirmed, unconfirmed };
  }

  // calculateAddressState: calculate electrum address state using local tx history
  function calculateAddressState(address: string): string | null {
    const localHistory = getAddressTransactions(address);

    //Log.debug("got localHistory", localHistory);

    // return null if address has no transactions
    if (
      localHistory.confirmed.length === 0 &&
      localHistory.unconfirmed.length === 0
    ) {
      return null;
    }

    const txToState = (tx) => `${tx.tx_hash}:${tx.height}:`;

    const stateString = localHistory.confirmed
      .map(txToState)
      .concat(localHistory.unconfirmed.map(txToState))
      .join("");

    const stateHash = sha256.text(stateString);

    //Log.debug("calculateAddressState", stateHash, stateString, address);
    return stateHash;
  }

  function nullifyAddressState(address: string) {
    try {
      walletDb.run("UPDATE addresses SET state=NULL WHERE address=?", [
        address,
      ]);
    } catch (e) {
      Log.error("nullifyAddressState", e);
    }
  }

  // AddressManager.registerTransaction: register a transaction with an address
  function registerTransaction(
    address: string,
    tx: { tx_hash: string; height: number },
    blockPos: number | null = null
  ): void {
    try {
      const existing = walletDb.exec(
        "SELECT * FROM address_transactions WHERE tx_hash=? AND address=?",
        [tx.tx_hash, address]
      );

      if (
        existing.length === 0 ||
        existing[0].height !== tx.height ||
        (existing[0].block_pos !== null && existing[0].block_pos !== blockPos)
      ) {
        walletDb.run(
          `INSERT INTO address_transactions (
          tx_hash,
          height,
          address,
          block_pos
        ) VALUES ($tx_hash, $tx_height, $address, $block_pos)
        ON CONFLICT DO
          UPDATE SET
            height=$tx_height,
            block_pos=$block_pos
          WHERE tx_hash=excluded.tx_hash;
        `,
          {
            $tx_hash: tx.tx_hash,
            $tx_height: tx.height,
            $address: address,
            $block_pos: blockPos,
          }
        );
      }
    } catch (e) {
      Log.error(e);
      const r = walletDb.exec(
        "SELECT * FROM address_transactions WHERE tx_hash=? AND address=?",
        [tx.tx_hash, address]
      );
      Log.warn(r[0]);
    }

    if (blockPos !== null) {
      TransactionManagerService().setBlockPos(tx.tx_hash, blockPos);
    }

    //Log.debug("AddressManager.registerTransaction", address, tx);
  }

  function registerTransactions(transactions) {
    //Log.debug("registerTransactions", transactions);
    try {
      // 4 params per row; SQLite limit is 999 variables
      const BATCH_SIZE = 249;
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => "(?, ?, ?, ?)").join(", ");
        const params = batch.flatMap((t) => [
          t.tx_hash,
          t.height,
          t.address,
          t.block_pos,
        ]);
        walletDb.run(
          `INSERT INTO address_transactions (tx_hash, height, address, block_pos)
          VALUES ${placeholders}
          ON CONFLICT DO
            UPDATE SET
              height=excluded.height,
              block_pos=excluded.block_pos
            WHERE tx_hash=excluded.tx_hash;`,
          params
        );
      }

      TransactionManagerService().setBlockPosBulk(transactions);
    } catch (e) {
      Log.error(e);
      throw e;
    }
  }
}

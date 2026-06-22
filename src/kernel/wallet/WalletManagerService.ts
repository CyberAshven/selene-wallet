import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { SimpleEncryption } from "capacitor-plugin-simple-encryption";
import { generateBip39Mnemonic } from "@bitauth/libauth";

import { store } from "@/redux";
import { selectBchNetwork } from "@/redux/preferences";

import DatabaseService, { SqlJsDatabase } from "@/kernel/app/DatabaseService";
import LogService from "@/kernel/app/LogService";

import translations from "@/views/wallet/translations";

import {
  DEFAULT_DERIVATION_PATH,
  ValidDerivationPath,
} from "@/util/derivation";
import { sha256 } from "@/util/hash";
import { getPrefix as getNetworkPrefix, ValidBchNetwork } from "@/util/network";

import { translate } from "@/util/translations";

const Log = LogService("WalletManager");

// WalletStub: minimum data required to build a wallet
export interface WalletStub {
  mnemonic: string;
  passphrase: string;
  derivation: ValidDerivationPath;
}

export interface WalletMeta {
  walletHash: string;
  name: string;
  balance: bigint;
  created_at: string;
  key_viewed_at: string;
}

export interface WalletEntity extends WalletStub, WalletMeta {
  key_verified_at: string;
  prefix: string;
  network: ValidBchNetwork;
  nonce: number;
  genesis_height: number | null;
  spendable_balance: bigint;
}

export class WalletNotExistsError extends Error {
  constructor(walletHash: string) {
    super(`No Wallet with walletHash ${walletHash}`);
  }
}

export default function WalletManagerService(injectedDeps?: {
  appDb?: SqlJsDatabase;
  network?: ValidBchNetwork;
}) {
  const Database = DatabaseService();
  const APP_DB = injectedDeps?.appDb ?? Database.getAppDatabase();
  const network = injectedDeps?.network ?? selectBchNetwork(store.getState());

  return {
    listWallets,
    getWallet,
    getWalletMeta,
    boot,
    createWallet,
    importWallet,
    createTemporaryWallet,
    deleteWallet,
    updateKeyViewed,
    updateKeyVerified,
    setWalletName,
    clearWalletData,
    restoreWalletData,
    exportWalletFile,
    importWalletFile,
    saveWallet,
    calculateWalletHash,
    openWalletDatabase,
    setGenesisHeight,
    fetchGenesisHeight,
    getPrefix,
  };

  // --------------------------------

  // listWallets: return a list of all wallets in the app database
  function listWallets(): WalletMeta[] {
    const result = APP_DB.exec(
      "SELECT * FROM wallets WHERE network=?",
      [network],
      { useBigInt: true }
    );

    //Log.debug("listWallets", result);
    return result;
  }

  // getWallet: synchronously get a consumable WalletEntity from the database
  function getWallet(walletHash): WalletEntity {
    if (!walletHash) {
      throw new WalletNotExistsError(walletHash);
    }

    const walletDb = Database.getWalletDatabase(walletHash);
    const result = walletDb.exec("SELECT * FROM wallet", null, {
      useBigInt: true,
    });

    if (result.length === 0) {
      throw new WalletNotExistsError(walletHash);
    }

    const wallet = result[0];

    wallet.network = network;

    // for safety, assume testnet unless we've explicitly stated to be on mainnet
    wallet.prefix = network === "mainnet" ? "bitcoincash" : "bchtest";

    wallet.nonce = 0;

    // useBigInt: true returns all ints as BigInt — convert small-int fields
    wallet.genesis_height =
      wallet.genesis_height != null ? Number(wallet.genesis_height) : null;

    return wallet;
  }

  function getWalletMeta(walletHash): WalletMeta {
    if (!walletHash) {
      throw new WalletNotExistsError(walletHash);
    }

    const result = APP_DB.exec(
      "SELECT * FROM wallets WHERE walletHash=$walletHash AND network=$network",
      { $walletHash: walletHash, $network: network },
      { useBigInt: true }
    );

    if (result.length === 0) {
      throw new WalletNotExistsError(walletHash);
    }

    const walletMeta = result[0];
    //Log.debug(walletMeta);
    return walletMeta;
  }

  // --------------------------------

  // boot: load a wallet, create a wallet if none exist
  async function boot(walletHash): Promise<WalletEntity> {
    let wallet: WalletEntity;
    try {
      // walletHash is blank on first-run, so throw immediately to create a new wallet
      if (walletHash === "") {
        throw new WalletNotExistsError("");
      }

      Log.debug("walletBoot ~", walletHash, network);

      // prevent Janitor from closing the active wallet handle
      Database.setKeepAlive(walletHash);

      // get the wallet db handle
      await Database.openWalletDatabase(walletHash, network);

      // get the WalletEntity
      wallet = getWallet(walletHash);
      //Log.debug("boot got", wallet);
    } catch (e) {
      if (!(e instanceof WalletNotExistsError)) {
        // something is REALLY wrong if we hit this path
        Log.warn("critical error during walletBoot!", e);
        throw e;
      }

      // requested wallet doesn't exist
      // attempt to return lowest-index wallet instead
      // create a new wallet if none exist
      const wallets = listWallets();

      let nextWalletHash = "";
      if (wallets.length > 0) {
        nextWalletHash = wallets[0].walletHash;
      } else {
        nextWalletHash = (
          await createWallet(translate(translations.mySeleneWallet))
        ).walletHash;
        Database.setKeepAlive(nextWalletHash);
      }

      return boot(nextWalletHash);
    }

    Database.flushHandles(true);

    Log.debug("walletBoot", walletHash, wallet, wallet.network);
    return wallet;
  }

  // --------------------------------

  // createWallet: generate a new wallet from a randomly generated seed phrase
  // persist the new wallet in the database
  async function createWallet(
    name: string = "New Wallet",
    passphrase: string = "",
    derivation: ValidDerivationPath = DEFAULT_DERIVATION_PATH
  ): Promise<WalletEntity> {
    const mnemonic = generateBip39Mnemonic();

    const walletHash = calculateWalletHash({
      mnemonic,
      passphrase,
      derivation,
    });

    Log.debug("createWallet", walletHash);

    const walletDb = await openWalletDatabase(walletHash);

    const result = walletDb.exec(
      `INSERT INTO wallet (
        walletHash,
        name,
        mnemonic,
        passphrase,
        derivation,
        genesis_height
      ) VALUES (?, ?, ?, ?, ?, 0)
      RETURNING *`,
      [walletHash, name, mnemonic, passphrase, derivation]
    )[0];

    APP_DB.run(
      `INSERT INTO wallets (
          walletHash,
          name,
          network
        ) VALUES (?, ?, ?)`,
      [walletHash, name, network]
    );

    Log.log("creating wallet", result);

    await saveWallet(walletHash);
    return result;
  }

  // importWallet: import a wallet via provided seed phrase
  // persist the imported wallet in the database
  async function importWallet(walletData) {
    const { mnemonic, passphrase, derivation, name } = walletData;

    const walletHash = calculateWalletHash({
      mnemonic,
      passphrase,
      derivation,
    });

    const walletDb = await openWalletDatabase(walletHash);

    const created_at = walletData.date_created
      ? walletData.date_created
      : walletData.created_at || new Date().toISOString();

    try {
      walletDb.run(
        `INSERT INTO wallet (
          name,
          mnemonic,
          passphrase,
          derivation,
          walletHash,
          created_at,
          key_viewed_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          strftime('%Y-%m-%dT%H:%M:%SZ')
        ) RETURNING *`,
        [name, mnemonic, passphrase, derivation, walletHash, created_at]
      );
    } catch (e) {
      Log.warn("wallet already exists in walletDb", walletHash, e);
    }

    try {
      APP_DB.run(
        `INSERT INTO wallets (
          walletHash,
          name,
          network,
          created_at,
          key_viewed_at
        ) VALUES (
          ?, ?, ?, ?,
          strftime('%Y-%m-%dT%H:%M:%SZ')
        )`,
        [walletHash, name, network, created_at]
      );
    } catch (e) {
      Log.warn("wallet already exists in appDb", walletHash, e);
    }

    Log.log("importing wallet", walletHash);
    await saveWallet(walletHash);
    return walletHash;
  }

  function createTemporaryWallet(walletStub: WalletStub) {
    const walletHash = calculateWalletHash(walletStub);
    const prefix = network === "mainnet" ? "bitcoincash" : "bchtest";

    return { ...walletStub, walletHash, prefix, network };
  }

  async function deleteWallet(walletHash, keepFile = false) {
    try {
      APP_DB.run("DELETE FROM wallets WHERE walletHash=?", [walletHash]);
      await Database.deleteWalletDatabase(walletHash, network);

      if (!keepFile) {
        await deleteWalletFile(walletHash);
      }
    } catch (e) {
      Log.warn(e);
    }
  }

  // updateKeyViewed: updates the wallet's key_viewed timestamp
  function updateKeyViewed(walletHash) {
    const walletDb = Database.getWalletDatabase(walletHash);

    const { key_viewed_at } = walletDb.exec(
      `UPDATE wallet SET key_viewed_at=strftime('%Y-%m-%dT%H:%M:%SZ') RETURNING key_viewed_at`
    )[0];

    APP_DB.run(
      `UPDATE wallets SET key_viewed_at=? WHERE walletHash=? AND network=?`,
      [key_viewed_at, walletHash, network]
    );

    Log.debug("keyViewed", key_viewed_at);

    return key_viewed_at;
  }

  // updateKeyVerified: updates the wallet's key_verified timestamp
  function updateKeyVerified(walletHash) {
    const walletDb = Database.getWalletDatabase(walletHash);

    walletDb.run(
      `UPDATE wallet SET key_verified_at=strftime('%Y-%m-%dT%H:%M:%SZ')`
    );
  }

  // setWalletName: sets a wallet's display name
  async function setWalletName(walletHash, name: string) {
    try {
      const walletDb = await Database.openWalletDatabase(walletHash);
      APP_DB.run(`UPDATE wallets SET name=? WHERE walletHash=?`, [
        name,
        walletHash,
      ]);
      walletDb.run(`UPDATE wallet SET name=?`, [name]);
    } catch (e) {
      Log.error(e);
    }

    Log.debug("setWalletName", walletHash, name);
    await saveWallet(walletHash);
  }

  // clearWalletData: deletes all data associated with a wallet
  // does NOT delete the wallet; all data can be re-derived/resynced
  // preserves memos and historical fiat amounts
  function clearWalletData(walletHash) {
    const walletDb = Database.getWalletDatabase(walletHash);

    // create temporary tables to preserve memos and fiat amounts
    walletDb.run(`CREATE TEMP TABLE IF NOT EXISTS temp_address_memos AS
      SELECT address, memo FROM addresses WHERE memo IS NOT NULL`);

    walletDb.run(`CREATE TEMP TABLE IF NOT EXISTS temp_transaction_data AS
      SELECT tx_hash, address, memo, fiat_amount, fiat_currency
      FROM address_transactions
      WHERE memo IS NOT NULL OR fiat_amount IS NOT NULL`);

    walletDb.run(`CREATE TEMP TABLE IF NOT EXISTS temp_utxo_memos AS
      SELECT address, tx_hash, tx_pos, memo
      FROM address_utxos
      WHERE memo IS NOT NULL`);

    // delete this wallet's transaction history
    walletDb.run(`DELETE FROM address_transactions`);
    walletDb.run(`DELETE FROM token_transactions`);

    // delete wallet addresses
    walletDb.run(`DELETE FROM addresses`);

    // delete wallet utxos
    walletDb.run(`DELETE FROM address_utxos`);

    walletDb.run("UPDATE wallet SET genesis_height=null");
  }

  // restoreWalletData: restores memos and fiat amounts from temporary tables
  // called after wallet rebuild to restore user data
  function restoreWalletData(walletHash) {
    const walletDb = Database.getWalletDatabase(walletHash);

    const hasTables = walletDb.exec(
      "SELECT name FROM temp.sqlite_schema WHERE type='table' AND name='temp_address_memos'"
    ).length;

    if (hasTables === 0) {
      Log.warn("no tables to restore");
      return;
    }

    // restore address memos
    walletDb.run(`UPDATE addresses
      SET memo = (SELECT memo FROM temp_address_memos WHERE temp_address_memos.address = addresses.address)
      WHERE address IN (SELECT address FROM temp_address_memos)`);

    // restore transaction memos and fiat amounts
    walletDb.run(`UPDATE address_transactions
      SET
        memo = (SELECT memo FROM temp_transaction_data WHERE temp_transaction_data.tx_hash = address_transactions.tx_hash AND temp_transaction_data.address = address_transactions.address),
        fiat_amount = (SELECT fiat_amount FROM temp_transaction_data WHERE temp_transaction_data.tx_hash = address_transactions.tx_hash AND temp_transaction_data.address = address_transactions.address),
        fiat_currency = (SELECT fiat_currency FROM temp_transaction_data WHERE temp_transaction_data.tx_hash = address_transactions.tx_hash AND temp_transaction_data.address = address_transactions.address)
      WHERE EXISTS (
        SELECT 1 FROM temp_transaction_data
        WHERE temp_transaction_data.tx_hash = address_transactions.tx_hash
        AND temp_transaction_data.address = address_transactions.address
      )`);

    // restore UTXO memos
    walletDb.run(`UPDATE address_utxos
      SET memo = (SELECT memo FROM temp_utxo_memos WHERE temp_utxo_memos.address = address_utxos.address AND temp_utxo_memos.tx_hash = address_utxos.tx_hash AND temp_utxo_memos.tx_pos = address_utxos.tx_pos)
      WHERE EXISTS (
        SELECT 1 FROM temp_utxo_memos
        WHERE temp_utxo_memos.address = address_utxos.address
        AND temp_utxo_memos.tx_hash = address_utxos.tx_hash
        AND temp_utxo_memos.tx_pos = address_utxos.tx_pos
      )`);

    // clean up temporary tables
    walletDb.run(`DROP TABLE IF EXISTS temp_address_memos`);
    walletDb.run(`DROP TABLE IF EXISTS temp_transaction_data`);
    walletDb.run(`DROP TABLE IF EXISTS temp_utxo_memos`);
  }

  function calculateWalletHash(wallet: WalletStub): string {
    const mnemonicHash = sha256.text(wallet.mnemonic);
    const passphraseHash =
      wallet.passphrase !== "" ? sha256.text(wallet.passphrase) : "";
    const derivationHash = sha256.text(wallet.derivation);

    const concatHashes = [mnemonicHash, passphraseHash, derivationHash].join(
      ""
    );

    const walletHash = sha256.text(concatHashes);
    return walletHash;
  }

  async function exportWalletFile(wallet: WalletEntity) {
    const { mnemonic, passphrase, derivation, name, created_at } = wallet;

    const walletHash = calculateWalletHash({
      mnemonic,
      passphrase,
      derivation,
    });

    const walletData = {
      walletHash,
      mnemonic,
      passphrase,
      derivation,
      created_at,
      name,
    };

    let data = JSON.stringify(walletData);

    ({ data } = await SimpleEncryption.encrypt({ data }));

    const result = await Filesystem.writeFile({
      path: `/selene/wallets/${walletHash}.wallet.json`,
      directory: Directory.Library,
      recursive: true,
      data,
      encoding: Encoding.UTF8,
    });

    Log.debug("exportWalletFile", result, walletData);
    return { result, walletHash };
  }

  async function importWalletFile(walletHash) {
    const walletFile = await Filesystem.readFile({
      path: `/selene/wallets/${walletHash}.wallet.json`,
      directory: Directory.Library,
      encoding: Encoding.UTF8,
    });

    let fileData = walletFile.data.toString();

    // Decrypt if encrypted (not plain JSON — web stub is a passthrough)
    if (!fileData.startsWith("{")) {
      ({ data: fileData } = await SimpleEncryption.decrypt({
        data: fileData,
      }));
    }

    await Database.openWalletDatabase(walletHash, network);
    const walletData = JSON.parse(fileData);

    try {
      await importWallet(walletData);
      try {
        await Database.flushDatabase(walletHash);
      } catch (e) {
        Log.error(e);
      }
    } catch (e) {
      Log.error("importWalletFile failed", walletHash, e);
      await Database.closeWalletDatabase(walletHash, true);
    }
  }

  async function deleteWalletFile(walletHash) {
    Log.debug("deleteWalletfile", walletHash);
    return Filesystem.deleteFile({
      path: `/selene/wallets/${walletHash}.wallet.json`,
      directory: Directory.Library,
    });
  }

  async function saveWallet(walletHash) {
    Log.debug("saveWallet", walletHash);

    const wallet = getWallet(walletHash);
    const { name, created_at, key_viewed_at, balance } = wallet;

    APP_DB.run(
      `UPDATE wallets SET
        name=?,
        created_at=?,
        key_viewed_at=?,
        balance=?
      WHERE walletHash=? AND network=?;`,
      [name, created_at, key_viewed_at, balance, walletHash, network]
    );

    await exportWalletFile(wallet);
    await Database.flushDatabase(walletHash);
    await Database.flushDatabase("app");
  }

  async function openWalletDatabase(walletHash) {
    return Database.openWalletDatabase(walletHash, network);
  }

  function setGenesisHeight(walletHash, height) {
    const walletDb = Database.getWalletDatabase(walletHash);
    walletDb.run(`UPDATE wallet SET genesis_height=?`, [height]);
    Log.debug("setGenesisHeight", height, walletHash);
  }

  async function fetchGenesisHeight(walletHash) {
    const walletDb = await openWalletDatabase(walletHash);
    const result = walletDb.exec("SELECT genesis_height FROM wallet");

    const { genesis_height } = result[0];

    Log.debug("fetchGenesisHeight", genesis_height, walletHash);
    return genesis_height;
  }

  function getPrefix() {
    return getNetworkPrefix(network);
  }
}

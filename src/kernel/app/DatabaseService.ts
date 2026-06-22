/* eslint-disable max-classes-per-file */
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import { SimpleEncryption } from "capacitor-plugin-simple-encryption";
import { base64ToBin, binToBase64 } from "@bitauth/libauth";
import initSqlJs from "sql.js";

import LogService from "@/kernel/app/LogService";

import {
  run_appdb_migrations,
  run_walletdb_migrations,
} from "@/util/migrations";
import { resultToJson } from "@/util/sql";

const Log = LogService("Database");

const APP_DB_FILENAME = "/selene/db/app.db";

// SQLite file header in base64: "SQLit" → "U1FMaXRl"
const SQLITE_HEADER_B64 = "U1FMaXRl";

// Legacy: SQLite file header as comma-separated byte values: 'S'=83, 'Q'=81, 'L'=76
const SQLITE_HEADER_CSV = "83,81,76,";

export class DatabaseNotOpenError extends Error {
  constructor(handle: string) {
    super(`No Database open with handle ${handle}`);
  }
}

export class DecryptionFailedError extends Error {
  filename: string;
  cause: unknown;
  constructor(filename: string, cause: unknown) {
    super(`Failed to decrypt database: ${filename}`);
    this.filename = filename;
    this.cause = cause;
  }
}

export interface SqlJsDatabase {
  exec: (...args: unknown[]) => unknown;
  export: () => Uint8Array;
  close: () => void;
  path: string;
}

const db_handles = new Map<string, SqlJsDatabase>();
const db_flushing = new Set<string>();
let db_keepalive: string | null = null;

// Connect to SQLite Database
Log.log("* Initializing SQLite *");
const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });

// _tryLoadAsRawSqlite: attempts to parse data as raw SQLite bytes despite missing header
// returns base64-encoded data if it loads as a valid database.
// throws DecryptionFailedError if not valid SQLite or decryptable
function _tryLoadAsRawSqlite(
  dbData: string,
  filename: string,
  decryptError: unknown
): string {
  try {
    const raw = base64ToBin(dbData);
    const testDb = new SQL.Database(raw);
    testDb.close();
    Log.warn("File loaded as raw SQLite despite missing header");
    return binToBase64(raw);
  } catch {
    throw new DecryptionFailedError(filename, decryptError);
  }
}

// atomicWrite: write to temp file, then rename into place.
// prevents corruption if the app crashes mid-write
async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  try {
    await Filesystem.writeFile({
      path: tmpPath,
      data,
      directory: Directory.Library,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Filesystem.rename({
      from: tmpPath,
      to: filePath,
      directory: Directory.Library,
      toDirectory: Directory.Library,
    });
  } catch (e) {
    try {
      await Filesystem.deleteFile({
        path: tmpPath,
        directory: Directory.Library,
      });
    } catch {
      // temp file may not exist
    }
    throw e;
  }
}

// _dbOpen: open a db file from filesystem
// by default, creates and initializes the db file if it doesn't exist
export async function _dbOpen(filename: string, skipCreate = false) {
  let db;
  try {
    // readFile throws if file doesn't exist
    const dbFile = await Filesystem.readFile({
      path: filename,
      directory: Directory.Library,
      encoding: Encoding.UTF8,
    });
    let dbData = dbFile.data.toString();

    // Check if data is encrypted (doesn't start with SQLite header)
    const isEncrypted =
      !dbData.startsWith(SQLITE_HEADER_B64) &&
      !dbData.startsWith(SQLITE_HEADER_CSV);

    if (isEncrypted) {
      try {
        const { data: decrypted } = await SimpleEncryption.decrypt({
          data: dbData,
        });
        dbData = decrypted;
      } catch (decryptError) {
        dbData = _tryLoadAsRawSqlite(dbData, filename, decryptError);
      }
    }

    // Parse database: base64 (new) or CSV (legacy)
    const dbBytes = dbData.startsWith(SQLITE_HEADER_CSV)
      ? new Uint8Array(dbData.split(",").map(Number))
      : base64ToBin(dbData);
    db = new SQL.Database(dbBytes);
  } catch (e) {
    if (skipCreate || e instanceof DecryptionFailedError) {
      throw e;
    }

    // create a new DB if file doesn't exist
    Log.warn("Creating database file", filename);
    db = new SQL.Database();
  }

  // force the exec function to return results using our resultToJson
  // otherwise we have to call resultToJson manually every time we query the db
  const dbExec = db.exec;
  db.exec = (...args) => resultToJson(dbExec.apply(db, args));

  // attach file path to db handle
  db.path = filename;

  return db;
}

// Re-encryption progress key in Capacitor Preferences
export const REENCRYPTION_KEY = "reencryption_oldkey";

// DatabaseService: brokers interactions with raw SQLite database
export default function DatabaseService() {
  return {
    initEncryption,
    openAppDatabase,
    getAppDatabase,
    getWalletDatabase,
    openWalletDatabase,
    closeWalletDatabase,
    deleteWalletDatabase,
    flushDatabase,
    flushHandles,
    setKeepAlive,
    getKeepAlive,
    closeAllDatabases,
    reencryptAllData,
    checkPendingReencryption,
    saveReencryptionMarker,
    clearReencryptionMarker,
    testDecryptAppDb,
  };

  // initEncryption: initializes encryption plugin (call once before opening databases)
  async function initEncryption(
    pin?: string
  ): Promise<{ isReady: boolean; hasPinConfigured: boolean }> {
    Log.time("initEncryption");
    try {
      const result = await SimpleEncryption.initialize({ pin });
      Log.log("Encryption initialized", result);
      return result;
    } catch (e) {
      Log.error("Encryption init failed", e);
      throw e;
    } finally {
      Log.timeEnd("initEncryption");
    }
  }

  // openAppDatabase: open the app database (call after encryption is ready).
  // Always called from boot(). No-op if already open.
  async function openAppDatabase(): Promise<void> {
    const existingDb = db_handles.get("app");
    if (existingDb) {
      return;
    }

    Log.time("openAppDatabase");

    // Re-encrypt files BEFORE opening databases (crash recovery)
    await checkPendingReencryption();

    const appDb = await _dbOpen(APP_DB_FILENAME);
    run_appdb_migrations(appDb);
    Log.log("Loaded app database");
    db_handles.set("app", appDb);
    Log.timeEnd("openAppDatabase");
  }

  // getAppDatabase: synchronously return the appDb handle
  // an error thrown here is critical
  function getAppDatabase() {
    const appDb = db_handles.get("app");
    if (!appDb) {
      throw new DatabaseNotOpenError("app");
    }

    return appDb;
  }

  // getWalletDatabase: synchronously return a wallet database handle
  // requires db handle to be open already; an error thrown here is critical
  function getWalletDatabase(walletHash) {
    const walletDb = db_handles.get(walletHash);
    if (!walletDb) {
      throw new DatabaseNotOpenError(walletHash);
    }

    return walletDb;
  }

  // openWalletDatabase: asynchronously open/return a wallet database handle
  // (returns db handle when ready)
  // throws DecryptionFailedError if per-wallet DB can't be decrypted
  async function openWalletDatabase(walletHash, network = "mainnet") {
    if (walletHash === "") {
      // something went very wrong if we hit this path
      throw new DatabaseNotOpenError(walletHash);
    }

    let walletDb = db_handles.get(walletHash);
    if (!walletDb) {
      //Log.time(`openWalletDatabase ${walletHash}`);
      const walletDbFilename = `/selene/db/${walletHash}.${network}.db`;
      walletDb = await _dbOpen(walletDbFilename);
      run_walletdb_migrations(walletDb);
      //Log.timeEnd(`openWalletDatabase ${walletHash}`);
    }

    db_handles.set(walletHash, walletDb);
    return walletDb;
  }

  async function closeWalletDatabase(walletHash, skipFlush = false) {
    if (!db_handles.has(walletHash)) {
      Log.warn("closeWalletDatabase: not open", walletHash);
      return;
    }

    // never close the db for the currently active wallet
    if (getKeepAlive() !== walletHash) {
      //Log.time(`closeWalletDatabase ${walletHash}`);
      if (!skipFlush) {
        await flushDatabase(walletHash);
      }

      const walletDb = getWalletDatabase(walletHash);
      walletDb.close();
      db_handles.delete(walletHash);
      //Log.timeEnd(`closeWalletDatabase ${walletHash}`);
    }
  }

  async function deleteWalletDatabase(walletHash, network) {
    await closeWalletDatabase(walletHash, true);

    return Filesystem.deleteFile({
      path: `/selene/db/${walletHash}.${network}.db`,
      directory: Directory.Library,
    });
  }

  // flushDatabase: writes database to disk
  // Never throws — errors are logged internally. Data remains in memory
  // and will be retried on the next flush cycle.
  // flushDatabase → encrypt + atomicWrite (can throw on I/O or encryption failure)
  async function flushDatabase(handle = "app") {
    if (db_flushing.has(handle)) {
      Log.debug("flushDatabase: already flushing, skipping", handle);
      return;
    }

    const db_handle = db_handles.get(handle);
    if (!db_handle) {
      Log.warn("flushDatabase: handle not open, skipping", handle);
      return;
    }

    db_flushing.add(handle);
    Log.time(`flushDatabase ${handle}`);
    try {
      // Export database as base64 string
      let data = binToBase64(db_handle.export());

      const { data: encrypted } = await SimpleEncryption.encrypt({ data });
      data = encrypted;

      await atomicWrite(db_handle.path, data);
      Log.debug("flushDatabase success", db_handle.path);
    } catch (e) {
      Log.error("flushDatabase failed", handle, e);
    } finally {
      db_flushing.delete(handle);
      Log.timeEnd(`flushDatabase ${handle}`);
    }
  }

  async function flushHandles(shouldCloseHandles: boolean = true) {
    Log.debug("flushHandles", db_handles);
    const promises = [...db_handles].map(([handle]) => {
      if (shouldCloseHandles && handle !== "app" && handle !== getKeepAlive()) {
        return closeWalletDatabase(handle, false);
      }

      // else flush without closing
      return flushDatabase(handle);
    });

    // Use allSettled to ensure all handles are attempted even if some fail
    const results = await Promise.allSettled(promises);
    const errors = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );
    if (errors.length > 0) {
      Log.error(`flushHandles: ${errors.length} handle(s) failed`, errors);
    }
  }

  function setKeepAlive(handle) {
    db_keepalive = handle;
  }

  function getKeepAlive() {
    return db_keepalive;
  }

  // Close ALL databases (including app DB and keepalive wallet).
  // Used by lock() to ensure no data remains in JS memory.
  async function closeAllDatabases() {
    db_keepalive = null; // clear keepalive so flushHandles won't skip it
    await flushHandles(true); // flush + close all wallet DBs

    // Close app DB (flushHandles only flushes it, never closes it)
    const appDb = db_handles.get("app");
    if (appDb) {
      appDb.close();
      db_handles.delete("app");
    }
  }

  // Re-encrypt all data files after a key import.
  // oldKeyBase64: the key that was used to encrypt existing files
  // Returns array of failed file paths (empty on full success)
  async function reencryptAllData(oldKeyBase64: string): Promise<string[]> {
    if (!Capacitor.isNativePlatform()) {
      return [];
    }

    Log.time("reencryptAllData");

    // Store old key as progress marker (cleared on success).
    // Note: SecuritySettings.handleImportBackup also saves this marker before
    // calling reencryptAllData, covering the crash window between key import
    // and re-encryption start. This set is idempotent (same key, same value).
    await saveReencryptionMarker(oldKeyBase64);

    try {
      // Flush in-memory databases to disk (uses current/new key);
      // _reencryptFile's new-key probe will detect these and skip them
      await flushHandles(false);

      // Close wallet handles (app stays open for continued use)
      db_keepalive = null;
      [...db_handles.keys()]
        .filter((handle) => handle !== "app")
        .forEach((handle) => {
          const walletDb = db_handles.get(handle);
          walletDb.close();
          db_handles.delete(handle);
        });

      const dbFailed = await _reencryptDirectory("/selene/db", oldKeyBase64);
      const walletFailed = await _reencryptDirectory(
        "/selene/wallets",
        oldKeyBase64
      );
      const allFailed = [...dbFailed, ...walletFailed];

      if (allFailed.length > 0) {
        Log.error(
          `Re-encryption incomplete: ${allFailed.length} files failed`,
          allFailed
        );
        // Do NOT clear marker — preserve old key for retry on next launch
      } else {
        await clearReencryptionMarker();
        Log.log("Re-encryption completed successfully");
      }

      return allFailed;
    } catch (e) {
      Log.error("Re-encryption failed (will retry on next launch)", e);
      throw e;
    } finally {
      Log.timeEnd("reencryptAllData");
    }
  }

  // Check for interrupted re-encryption on startup
  async function checkPendingReencryption() {
    const { value: oldKeyBase64 } = await Preferences.get({
      key: REENCRYPTION_KEY,
    });
    if (!oldKeyBase64) {
      return;
    }

    Log.log("Found pending re-encryption, resuming...");
    await reencryptAllData(oldKeyBase64);
  }

  // Save the old key as a re-encryption progress marker
  async function saveReencryptionMarker(oldKeyBase64: string) {
    await Preferences.set({ key: REENCRYPTION_KEY, value: oldKeyBase64 });
  }

  // Clear the re-encryption progress marker
  async function clearReencryptionMarker() {
    await Preferences.remove({ key: REENCRYPTION_KEY });
  }

  // Test that the current encryption key can decrypt app.db
  // Throws DecryptionFailedError if decryption fails
  async function testDecryptAppDb() {
    const testDb = await _dbOpen(APP_DB_FILENAME, true);
    testDb.close();
  }
}

// Re-encrypt a single file from oldKey to current (new) key.
// Uses atomic write-to-temp-then-rename to prevent corruption on crash.
async function _reencryptFile(filePath: string, oldKeyBase64: string) {
  const fileData = await Filesystem.readFile({
    path: filePath,
    directory: Directory.Library,
    encoding: Encoding.UTF8,
  });
  const rawData = fileData.data.toString();

  // Skip unencrypted files (SQLite header in base64 or legacy CSV)
  if (
    rawData.startsWith(SQLITE_HEADER_B64) ||
    rawData.startsWith(SQLITE_HEADER_CSV)
  )
    return;

  // Handle plain JSON wallet files (pre-encryption era)
  try {
    JSON.parse(rawData);
    // Valid JSON — encrypt directly with current key and write atomically
    const { data: encrypted } = await SimpleEncryption.encrypt({
      data: rawData,
    });
    await atomicWrite(filePath, encrypted);
    Log.debug("Encrypted plain JSON file:", filePath);
    return;
  } catch {
    // Not JSON — continue with re-encryption logic below
  }

  // Try decrypting with new key first (already re-encrypted)
  try {
    await SimpleEncryption.decrypt({ data: rawData });
    return; // Already encrypted with new key
  } catch {
    // Not encrypted with current key - will try old key below
  }

  // Decrypt with old key, encrypt with new key, write atomically
  let plainData: string;
  try {
    ({ data: plainData } = await SimpleEncryption.decryptWithExplicitKey({
      data: rawData,
      key: oldKeyBase64,
    }));
  } catch (e) {
    Log.error(
      `Cannot decrypt ${filePath} with either key (possible corruption)`,
      e
    );
    throw e;
  }
  const { data: reencrypted } = await SimpleEncryption.encrypt({
    data: plainData,
  });
  await atomicWrite(filePath, reencrypted);
  Log.debug("Re-encrypted file:", filePath);
}

// Re-encrypt all files in a directory from oldKey to current (new) key
async function _reencryptDirectory(dirPath: string, oldKeyBase64: string) {
  let files;
  try {
    const result = await Filesystem.readdir({
      path: dirPath,
      directory: Directory.Library,
    });
    files = result.files.filter((f) => f.type === "file");
  } catch {
    return []; // Directory doesn't exist - nothing to re-encrypt
  }

  // Sequential processing - each file must complete before next
  // Skip files that fail (may be corrupted) rather than halting entirely
  const failedFiles: string[] = [];
  await files.reduce(
    (chain, file) =>
      chain.then(async () => {
        const filePath = `${dirPath}/${file.name}`;
        try {
          await _reencryptFile(filePath, oldKeyBase64);
        } catch (e) {
          Log.error(`Skipping failed re-encrypt of ${filePath}`, e);
          failedFiles.push(filePath);
        }
      }),
    Promise.resolve()
  );
  return failedFiles;
}

// HERE BE SATS if someone wants to try to steal them!
// Some ancient commit will load this wallet, but send wasn't implemented yet...
/*const _fakeDb = [
  {
    name: "Selene Test",
    //k: "73,64,6,145,107,79,169,89,142,119,169,158,122,115,156,60,45,234,0,74,208,131,25,53,197,120,36,176,37,105,201,119",
    k: "[object Object]",
  },
];*/

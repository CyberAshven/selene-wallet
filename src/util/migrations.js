import LogService from "@/kernel/app/LogService";

import { DEFAULT_DERIVATION_PATH } from "@/util/derivation";

const Log = LogService("migrations");

// functions in the migrations array will be executed sequentially,
// starting with the function at index PRAGMA user_version
// each entry should represent a new db version
const appdb_migrations = [
  function migrate_v0() {
    const query = [];

    query.push("PRAGMA user_version = 0;");

    query.push("DROP TABLE IF EXISTS wallets;");
    query.push("DROP TABLE IF EXISTS blockchain;");
    query.push("DROP TABLE IF EXISTS transactions;");
    query.push("DROP TABLE IF EXISTS bcmr;");
    query.push("DROP TABLE IF EXISTS bcmr_tokens;");

    // WalletMeta
    query.push(
      `CREATE TABLE IF NOT EXISTS wallets ( 
        walletHash text not null,
        name text default "" not null,
        balance int default 0,
        created_at text default ( strftime('%Y-%m-%dT%H:%M:%SZ') ),
        key_viewed_at text default null,
        network text not null CHECK(network IN ("mainnet", "chipnet", "testnet3", "testnet4")) default "mainnet",
        UNIQUE(walletHash, network)
      );`
    );

    query.push(
      `CREATE TABLE IF NOT EXISTS blockchain (
        blockhash text primary key,
        height int not null
      );`
    );

    query.push(
      `CREATE TABLE IF NOT EXISTS transactions (
        txid text primary key not null, 
        time_seen default ( strftime('%Y-%m-%dT%H:%M:%SZ') ),
        time int,
        blocktime int,
        blockhash text,
        size int,
        version int
      );`
    );

    query.push("PRAGMA user_version = 1;");

    return query.join("");
  },
  function migrate_v1() {
    const query = [];

    // add height column to transaction table
    query.push(
      "ALTER TABLE transactions ADD COLUMN height int not null default 0;"
    );

    query.push("PRAGMA user_version = 2;");

    return query.join("");
  },
  function migrate_v2() {
    const query = [];

    // add BCMR tables
    query.push(
      `CREATE TABLE IF NOT EXISTS bcmr (
        authbase text primary key not null,
        registryUri text not null,
        lastFetch not null default ( strftime('%Y-%m-%dT%H:%M:%SZ') )
      );`
    );

    query.push(
      `CREATE TABLE IF NOT EXISTS bcmr_tokens (
        category text primary key not null,
        authbase text not null,
        symbol text default null unique,
        decimals int default 0 not null
      );`
    );

    query.push("PRAGMA user_version = 3;");

    return query.join("");
  },
  function migrate_v3() {
    const query = [];

    // add block_pos column to transaction table
    query.push(
      "ALTER TABLE transactions ADD COLUMN block_pos int default null;"
    );

    query.push("PRAGMA user_version = 4;");

    return query.join("");
  },
  function migrate_v4() {
    const query = [];

    // add coinbase column to transaction table
    query.push(
      "ALTER TABLE transactions ADD COLUMN coinbase text default null;"
    );

    query.push("PRAGMA user_version = 5;");

    return query.join("");
  },
  function migrate_v5() {
    const query = [];

    // Recreate transactions: rename txid → tx_hash, make height nullable
    // height: null = broadcast, not verified in mempool; 0 = in mempool; >0 = confirmed
    // Column order after v0+v1+v3+v4: txid, time_seen, time, blocktime, blockhash, size, version, height, block_pos, coinbase
    query.push(
      `CREATE TABLE transactions_new (
        tx_hash text primary key not null,
        time_seen default ( strftime('%Y-%m-%dT%H:%M:%SZ') ),
        time int,
        blocktime int,
        blockhash text,
        size int,
        version int,
        height int default null,
        block_pos int default null,
        coinbase text default null
      );`
    );
    query.push("INSERT INTO transactions_new SELECT * FROM transactions;");
    query.push("DROP TABLE transactions;");
    query.push("ALTER TABLE transactions_new RENAME TO transactions;");

    // wallets: balance int → bigint (needs table recreation)
    query.push(
      `CREATE TABLE wallets_new (
        walletHash text not null,
        name text default "" not null,
        balance bigint default 0,
        created_at text default ( strftime('%Y-%m-%dT%H:%M:%SZ') ),
        key_viewed_at text default null,
        network text not null CHECK(network IN ("mainnet","chipnet","testnet3","testnet4")) default "mainnet",
        UNIQUE(walletHash, network)
      );`
    );
    query.push("INSERT INTO wallets_new SELECT * FROM wallets;");
    query.push("DROP TABLE wallets;");
    query.push("ALTER TABLE wallets_new RENAME TO wallets;");

    query.push("PRAGMA user_version = 6;");

    return query.join("");
  },
  /*function migrate_v6() {
    const query = [];

    query.push("PRAGMA user_version = 7;");

    return query.join("");
  },*/
];

const walletdb_migrations = [
  function migrate_v0() {
    const query = [];

    query.push("PRAGMA user_version = 0;");

    query.push("DROP TABLE IF EXISTS wallet;");
    query.push("DROP TABLE IF EXISTS addresses;");
    query.push("DROP TABLE IF EXISTS address_utxos;");
    query.push("DROP TABLE IF EXISTS address_transactions;");
    query.push("DROP TABLE IF EXISTS token_transactions;");
    query.push("DROP TRIGGER IF EXISTS balance_update;");
    query.push("DROP TRIGGER IF EXISTS spendable_balance_update;");
    query.push("DROP TRIGGER IF EXISTS utxo_balance_delete;");
    query.push("DROP TRIGGER IF EXISTS utxo_balance_insert;");
    query.push("DROP INDEX IF EXISTS idx_address_transactions;");
    query.push("DROP INDEX IF EXISTS idx_address_utxos;");

    // WalletEntity
    query.push(
      `CREATE TABLE IF NOT EXISTS wallet ( 
        walletHash text primary key not null, 
        mnemonic text not null, 
        passphrase text default "" not null,
        derivation text default "${DEFAULT_DERIVATION_PATH}" not null,
        name text not null, 
        balance int default 0 not null,
        genesis_height int default null,
        created_at text default ( strftime('%Y-%m-%dT%H:%M:%SZ') ),
        key_viewed_at text default null, 
        key_verified_at text default null 
      );`
    );

    // AddressEntity
    query.push(
      `CREATE TABLE IF NOT EXISTS addresses (
        address text primary key not null, 
        hd_index int not null, 
        balance int default 0 not null, 
        change int default 0 not null, 
        state text default null,
        memo text default null
      );`
    );

    query.push(
      `CREATE TABLE IF NOT EXISTS address_transactions (
        txid text not null, 
        height int default 0 not null,
        address text not null,
        time text default ( strftime('%Y-%m-%dT%H:%M:%SZ') ),
        time_seen text default ( strftime('%Y-%m-%dT%H:%M:%SZ') ),
        amount int,
        fiat_amount text,
        fiat_currency text,
        memo text default null,
        UNIQUE(txid, address)
      );`
    );

    query.push(
      `CREATE INDEX idx_address_transactions ON address_transactions (address);`
    );

    query.push(
      `CREATE TABLE IF NOT EXISTS address_utxos (
        address text not null,
        txid text not null,
        tx_pos int not null,
        amount int not null,
        memo text default null
      );`
    );

    query.push(`CREATE INDEX idx_address_utxos ON address_utxos (address);`);

    // update total wallet balance when address balances are updated
    query.push(
      `CREATE TRIGGER IF NOT EXISTS balance_update AFTER UPDATE ON addresses
        BEGIN
          UPDATE wallet SET 
            balance=(
              SELECT SUM(balance) FROM addresses 
            )
          ;
        END
      ;`
    );

    // update address balances immediately when local utxo set is updated
    query.push(
      `CREATE TRIGGER IF NOT EXISTS utxo_balance_delete AFTER DELETE ON address_utxos
        BEGIN
          UPDATE addresses SET 
            balance=(
              SELECT COALESCE(SUM(amount), 0) FROM address_utxos
              WHERE address=OLD.address
            ) WHERE address=OLD.address
          ;
        END
      ;`
    );

    query.push(
      `CREATE TRIGGER IF NOT EXISTS utxo_balance_insert AFTER INSERT ON address_utxos
        BEGIN
          UPDATE addresses SET 
            balance=(
              SELECT COALESCE(SUM(amount), 0) FROM address_utxos
              WHERE address=NEW.address
            ) WHERE address=NEW.address
          ;
        END
      ;`
    );

    query.push("PRAGMA user_version = 1;");

    return query.join("");
  },
  function migrate_v1() {
    const query = [];

    // fix history time column to use unix time
    query.push("ALTER TABLE address_transactions DROP COLUMN time;");
    query.push(
      "ALTER TABLE address_transactions ADD COLUMN time int default null;"
    );

    query.push("PRAGMA user_version = 2;");

    return query.join("");
  },
  function migrate_v2() {
    const query = [];

    // add CashToken data to UTXOs
    query.push(
      "ALTER TABLE address_utxos ADD COLUMN token_category text default null;"
    );
    query.push(
      "ALTER TABLE address_utxos ADD COLUMN token_amount int default null;"
    );
    query.push(
      "ALTER TABLE address_utxos ADD COLUMN nft_capability text default null;"
    );
    query.push(
      "ALTER TABLE address_utxos ADD COLUMN nft_commitment text default null;"
    );

    query.push("PRAGMA user_version = 3;");

    return query.join("");
  },
  function migrate_v3() {
    const query = [];

    // keep account of non-token balance separately from balance with token UTXOs
    query.push(
      "ALTER TABLE wallet ADD COLUMN spendable_balance int default 0;"
    );

    query.push(
      `CREATE TRIGGER IF NOT EXISTS spendable_balance_update AFTER UPDATE ON wallet
        BEGIN
          UPDATE wallet SET 
            spendable_balance=(
              SELECT COALESCE(SUM(amount), 0) FROM address_utxos
              WHERE token_category IS NULL
            ) 
          ;
        END
      ;`
    );

    query.push("PRAGMA user_version = 4;");

    return query.join("");
  },
  function migrate_v4() {
    const query = [];

    query.push(
      `CREATE TABLE IF NOT EXISTS token_transactions (
        txid text not null, 
        category text not null,
        fungible_amount int,
        nft_amount int,
        UNIQUE(category, txid)
      );`
    );

    query.push("PRAGMA user_version = 5;");

    return query.join("");
  },
  function migrate_v5() {
    const query = [];

    // 2024.04.4: users upgrading to 2024.04.3 experienced an issue where balances reported as zero
    // rebuilding the wallet fixes this. let's force everyone to rebuild just in case.
    query.push(`UPDATE wallet SET genesis_height=NULL;`);

    query.push("PRAGMA user_version = 6;");

    return query.join("");
  },
  function migrate_v6() {
    const query = [];

    // create an index for unused addresses (measured 3x performance increase)
    query.push(
      "CREATE INDEX idx_addresses_unused ON addresses (change, state, hd_index);"
    );

    query.push("PRAGMA user_version = 7;");

    return query.join("");
  },
  function migrate_v7() {
    const query = [];

    // add block_pos column to address_transaction table
    query.push(
      "ALTER TABLE address_transactions ADD COLUMN block_pos int default null;"
    );

    query.push("PRAGMA user_version = 8;");

    return query.join("");
  },
  function migrate_v8() {
    const query = [];

    // Recreate ALL 5 tables: rename txid→tx_hash, amount→valueSatoshis, int→bigint

    // 1. Drop ALL triggers and indexes first
    query.push("DROP TRIGGER IF EXISTS balance_update;");
    query.push("DROP TRIGGER IF EXISTS utxo_balance_delete;");
    query.push("DROP TRIGGER IF EXISTS utxo_balance_insert;");
    query.push("DROP TRIGGER IF EXISTS spendable_balance_update;");
    query.push("DROP INDEX IF EXISTS idx_address_utxos;");
    query.push("DROP INDEX IF EXISTS idx_address_transactions;");
    query.push("DROP INDEX IF EXISTS idx_addresses_unused;");

    // 2. wallet table (balance, spendable_balance → bigint)
    query.push(
      `CREATE TABLE wallet_new (
        walletHash text primary key not null,
        mnemonic text not null,
        passphrase text default "" not null,
        derivation text default "${DEFAULT_DERIVATION_PATH}" not null,
        name text not null,
        balance bigint default 0 not null,
        genesis_height int default null,
        created_at text default ( strftime('%Y-%m-%dT%H:%M:%SZ') ),
        key_viewed_at text default null,
        key_verified_at text default null,
        spendable_balance bigint default 0
      );`
    );
    query.push("INSERT INTO wallet_new SELECT * FROM wallet;");
    query.push("DROP TABLE wallet;");
    query.push("ALTER TABLE wallet_new RENAME TO wallet;");

    // 3. addresses table (balance → bigint)
    query.push(
      `CREATE TABLE addresses_new (
        address text primary key not null,
        hd_index int not null,
        balance bigint default 0 not null,
        change int default 0 not null,
        state text default null,
        memo text default null
      );`
    );
    query.push("INSERT INTO addresses_new SELECT * FROM addresses;");
    query.push("DROP TABLE addresses;");
    query.push("ALTER TABLE addresses_new RENAME TO addresses;");
    query.push(
      "CREATE INDEX idx_addresses_unused ON addresses (change, state, hd_index);"
    );

    // 4. address_utxos (txid→tx_hash, amount→valueSatoshis, token_amount→bigint)
    query.push(
      `CREATE TABLE address_utxos_new (
        address text not null,
        tx_hash text not null,
        tx_pos int not null,
        valueSatoshis bigint not null,
        memo text default null,
        token_category text default null,
        token_amount bigint default null,
        nft_capability text default null,
        nft_commitment text default null
      );`
    );
    query.push("INSERT INTO address_utxos_new SELECT * FROM address_utxos;");
    query.push("DROP TABLE address_utxos;");
    query.push("ALTER TABLE address_utxos_new RENAME TO address_utxos;");
    query.push("CREATE INDEX idx_address_utxos ON address_utxos (address);");

    // 5. address_transactions (txid→tx_hash, amount→valueSatoshis, fix column order)
    // Old column order (after v0+v1+v7): txid, height, address, time_seen,
    //   amount, fiat_amount, fiat_currency, memo, time(end!), block_pos
    query.push(
      `CREATE TABLE address_transactions_new (
        tx_hash text not null,
        height int default 0 not null,
        address text not null,
        time int default null,
        time_seen text default ( strftime('%Y-%m-%dT%H:%M:%SZ') ),
        valueSatoshis bigint,
        fiat_amount text,
        fiat_currency text,
        memo text default null,
        block_pos int default null,
        UNIQUE(tx_hash, address)
      );`
    );
    // Explicit column mapping (can't use SELECT * — column order changed)
    query.push(
      `INSERT INTO address_transactions_new
        (tx_hash, height, address, time, time_seen, valueSatoshis, fiat_amount, fiat_currency, memo, block_pos)
      SELECT txid, height, address, time, time_seen, amount, fiat_amount, fiat_currency, memo, block_pos
      FROM address_transactions;`
    );
    query.push("DROP TABLE address_transactions;");
    query.push(
      "ALTER TABLE address_transactions_new RENAME TO address_transactions;"
    );
    query.push(
      "CREATE INDEX idx_address_transactions ON address_transactions (address);"
    );

    // 6. token_transactions (txid→tx_hash, fungible_amount→bigint, nft_amount stays int)
    query.push(
      `CREATE TABLE token_transactions_new (
        tx_hash text not null,
        category text not null,
        fungible_amount bigint,
        nft_amount int,
        UNIQUE(category, tx_hash)
      );`
    );
    query.push(
      "INSERT INTO token_transactions_new SELECT * FROM token_transactions;"
    );
    query.push("DROP TABLE token_transactions;");
    query.push(
      "ALTER TABLE token_transactions_new RENAME TO token_transactions;"
    );

    // 7. Recreate ALL triggers with new column names
    query.push(
      `CREATE TRIGGER IF NOT EXISTS balance_update AFTER UPDATE ON addresses
        BEGIN
          UPDATE wallet SET
            balance=(SELECT SUM(balance) FROM addresses);
        END;`
    );

    query.push(
      `CREATE TRIGGER IF NOT EXISTS utxo_balance_delete AFTER DELETE ON address_utxos
        BEGIN
          UPDATE addresses SET
            balance=(
              SELECT COALESCE(SUM(valueSatoshis),0) FROM address_utxos
              WHERE address=OLD.address
            ) WHERE address=OLD.address;
        END;`
    );

    query.push(
      `CREATE TRIGGER IF NOT EXISTS utxo_balance_insert AFTER INSERT ON address_utxos
        BEGIN
          UPDATE addresses SET
            balance=(
              SELECT COALESCE(SUM(valueSatoshis),0) FROM address_utxos
              WHERE address=NEW.address
            ) WHERE address=NEW.address;
        END;`
    );

    query.push(
      `CREATE TRIGGER IF NOT EXISTS spendable_balance_update AFTER UPDATE OF balance ON wallet
        BEGIN
          UPDATE wallet SET
            spendable_balance=(
              SELECT COALESCE(SUM(valueSatoshis),0) FROM address_utxos
              WHERE token_category IS NULL
            );
        END;`
    );

    query.push("PRAGMA user_version = 9;");

    return query.join("");
  },
  /*function migrate_v9() {
    const query = [];

    query.push("PRAGMA user_version = 10;");

    return query.join("");
  },*/
];

// run_migrations: run all migrations in migrations array sequentially
// Starts with index indicated in PRAGMA user_version
export function run_migrations(migrations, db) {
  //Log.time("dbMigrate");
  const DB_VERSION = db.exec("PRAGMA user_version")[0].user_version;
  //Log.log("DB_VERSION", DB_VERSION, migrations.length);
  for (let version = DB_VERSION; version < migrations.length; version += 1) {
    Log.log("DB_MIGRATE", `${version}/${migrations.length}`, DB_VERSION);
    try {
      //Log.debug(migrations[version]());
      db.run(migrations[version]());
    } catch (e) {
      Log.error("error during migrations", e);
      return false;
    }
  }
  //Log.timeEnd("dbMigrate");
  return true;
}

export function run_appdb_migrations(appDb) {
  //appDb.run("PRAGMA user_version = 0;");
  return run_migrations(appdb_migrations, appDb);
}

export function run_walletdb_migrations(walletDb) {
  //walletDb.run("PRAGMA user_version = 0;");
  return run_migrations(walletdb_migrations, walletDb);
}

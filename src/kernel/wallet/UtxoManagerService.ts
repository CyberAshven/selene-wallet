import DatabaseService, { SqlJsDatabase } from "@/kernel/app/DatabaseService";
import LogService from "@/kernel/app/LogService";

const Log = LogService("UtxoManager");

type TokenNftCapability = "none" | "mutable" | "minting";

export interface UtxoEntity {
  address: string;
  tx_hash: string;
  tx_pos: number;
  valueSatoshis: bigint;
  memo: string | null;
  token_category: string | null;
  token_amount: bigint | null;
  nft_capability: TokenNftCapability | null;
  nft_commitment: string | null;
}

/** sql.js row → UtxoEntity (converts tx_pos from BigInt to number) */
function normalizeUtxoRow(row: Record<string, unknown>): UtxoEntity {
  return { ...row, tx_pos: Number(row.tx_pos) } as UtxoEntity;
}

export default function UtxoManagerService(
  walletHash: string,
  injectedDb?: SqlJsDatabase
) {
  const walletDb =
    injectedDb ?? DatabaseService().getWalletDatabase(walletHash);

  return {
    getUtxo,
    registerUtxo,
    getWalletUtxos,
    getWalletCoins,
    getWalletTokens,
    getAddressUtxos,
    getAddressCoins,
    getCategoryUtxos,
    selectCoins,
    selectTokens,
    targetUtxos,
    discardUtxo,
    discardAddressUtxos,
  };

  function getUtxo(utxo_id: string): UtxoEntity {
    const [tx_hash, tx_pos] = utxo_id.split(":");

    const result = walletDb.exec(
      "SELECT * FROM address_utxos WHERE tx_hash=? AND tx_pos=?",
      [tx_hash, tx_pos],
      { useBigInt: true }
    )[0];

    return normalizeUtxoRow(result);
  }

  function registerUtxo(utxo: UtxoEntity) {
    //Log.debug("registerUtxo", utxo);

    try {
      walletDb.run(
        `INSERT INTO address_utxos (
        address,
        tx_hash,
        tx_pos,
        valueSatoshis,
        token_category,
        token_amount,
        nft_capability,
        nft_commitment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          utxo.address,
          utxo.tx_hash,
          utxo.tx_pos,
          utxo.valueSatoshis,
          utxo.token_category,
          utxo.token_amount,
          utxo.nft_capability,
          utxo.nft_commitment,
        ]
      );
      //Log.debug("registerUtxo done");
    } catch (e) {
      Log.error(e);
    }
  }

  // returns all UTXOs for the wallet
  function getWalletUtxos() {
    const result = walletDb.exec(`SELECT * FROM address_utxos`, null, {
      useBigInt: true,
    });
    //Log.debug(result);
    return result.map(normalizeUtxoRow);
  }

  // returns all non-token UTXOs for the wallet
  function getWalletCoins() {
    const result = walletDb.exec(
      `SELECT * FROM address_utxos WHERE token_category IS NULL`,
      null,
      { useBigInt: true }
    );
    return result.map(normalizeUtxoRow);
  }

  // returns all token UTXOs for the wallet
  function getWalletTokens() {
    const result = walletDb.exec(
      `SELECT * FROM address_utxos WHERE token_category IS NOT NULL ORDER BY token_category ASC`,
      null,
      { useBigInt: true }
    );
    return result.map(normalizeUtxoRow);
  }

  // returns all UTXOs for an address in the wallet
  function getAddressUtxos(address: string): Array<UtxoEntity> {
    const result = walletDb.exec(
      `SELECT * FROM address_utxos WHERE address=? ORDER BY valueSatoshis ASC`,
      [address],
      { useBigInt: true }
    );
    return result.map(normalizeUtxoRow);
  }

  // returns all non-token UTXOs for an address in the wallet
  function getAddressCoins(address: string) {
    const result = walletDb.exec(
      `SELECT * FROM address_utxos WHERE address=? AND token_category IS NULL ORDER BY valueSatoshis ASC`,
      [address],
      { useBigInt: true }
    );
    return result.map(normalizeUtxoRow);
  }

  function getCategoryUtxos(category: string) {
    const result = walletDb.exec(
      "SELECT * FROM address_utxos WHERE token_category=? ORDER BY token_amount DESC",
      [category],
      { useBigInt: true }
    );

    return result.map(normalizeUtxoRow);
  }

  function selectTokens(category: string, amount: bigint) {
    const targetAmount = amount;

    const tokenUtxos = getCategoryUtxos(category);
    const availableTokenSum = tokenUtxos.reduce(
      (sum, cur) => sum + (cur.token_amount ?? 0n),
      0n
    );

    Log.debug(
      "selectTokens",
      category,
      targetAmount,
      tokenUtxos,
      availableTokenSum
    );

    if (availableTokenSum < targetAmount || targetAmount === 0n) {
      return [];
    }

    // Prefer pure-FT UTXOs to avoid pulling in NFTs unnecessarily
    const pureFt = tokenUtxos.filter((u) => u.nft_capability === null);
    const pureFtSum = pureFt.reduce(
      (sum, cur) => sum + (cur.token_amount ?? 0n),
      0n
    );

    // Try to fulfill from pure-FT UTXOs first
    if (pureFtSum >= targetAmount) {
      const thresholdUtxo = pureFt
        .filter((u) => (u.token_amount ?? 0n) >= targetAmount)
        .pop();

      if (thresholdUtxo) {
        return [thresholdUtxo];
      }

      let remainingAmount = targetAmount;
      const consumedUtxos: Array<UtxoEntity> = [];
      const pool = [...pureFt];
      while (remainingAmount > 0n && pool.length > 0) {
        const utxo = pool.shift();
        if (!utxo) break;
        consumedUtxos.push(utxo);
        remainingAmount -= utxo.token_amount ?? 0n;
      }

      if (remainingAmount <= 0n) {
        return consumedUtxos;
      }
    }

    // Fall back to all UTXOs (including hybrid FT+NFT)
    const thresholdUtxo = tokenUtxos
      .filter((u) => (u.token_amount ?? 0n) >= targetAmount)
      .pop();

    if (thresholdUtxo) {
      return [thresholdUtxo];
    }

    let remainingAmount = targetAmount;
    const consumedUtxos: Array<UtxoEntity> = [];
    while (remainingAmount > 0n) {
      const utxo = tokenUtxos.shift();

      if (!utxo) {
        return [];
      }

      consumedUtxos.push(utxo);
      remainingAmount -= utxo.token_amount ?? 0n;
    }

    return consumedUtxos;
  }

  // attempts to find the best combination of UTXOs to fulfill the amount and fee
  function selectCoins(amount: bigint) {
    const targetAmount = amount;
    Log.debug("selectCoins", targetAmount);

    // get all available UTXOs (without tokens)
    const allAvailableCoins = getWalletCoins();
    //const allAvailableCoins = getWalletUtxos();

    const availableCoinSum = allAvailableCoins.reduce(
      (sum, utxo) => sum + utxo.valueSatoshis,
      0n
    );

    // check if we have enough balance across all UTXOs
    // empty set = insufficient funds
    if (availableCoinSum < targetAmount || targetAmount === 0n) {
      return [];
    }

    // 1. if there's an exact UTXO, use that UTXO *and* its address-mates (for privacy)
    const exactCoins = allAvailableCoins.filter(
      (utxo) => utxo.valueSatoshis === targetAmount
    );
    if (exactCoins.length > 0) {
      Log.debug("selectCoins exactCoin", exactCoins[0].address);
      // spend all utxos on this address for privacy
      return getAddressCoins(exactCoins[0].address);
    }

    // consider all addresses with balance >= amount
    // in ASCENDING order so smallest address over threshold is first (for privacy)
    const eligibleAddresses = walletDb.exec(
      `SELECT * FROM addresses
          WHERE
            balance >= ?
          ORDER BY balance ASC`,
      [targetAmount.toString()],
      { useBigInt: true }
    );

    Log.debug("eligibleAddresses", eligibleAddresses);

    // 2. if there's a whole address balance that's exact, spend the entire address
    const exactAddresses = eligibleAddresses.filter(
      (address) => address.balance === targetAmount
    );
    if (exactAddresses.length > 0) {
      Log.debug("selectCoins exactAddress", exactAddresses[0].address);
      return getAddressCoins(exactAddresses[0].address);
    }

    // 3. select from all available UTXOs
    const eligibleCoins = targetUtxos(allAvailableCoins, targetAmount);

    // 0th-index eligible address is smallest with balance >= targetAmount
    let coinAddress = eligibleAddresses.shift();
    while (coinAddress !== undefined) {
      const addressCoins = targetUtxos(
        getAddressCoins(coinAddress.address),
        targetAmount
      );

      const addressCoinSum = addressCoins.selection.reduce(
        (sum, cur) => sum + cur.valueSatoshis,
        0n
      );

      // if it's cheaper to spend the "eligible address", do that instead of consolidating utxos
      if (
        addressCoinSum >= targetAmount &&
        addressCoins.selection.length <= eligibleCoins.selection.length
      ) {
        Log.debug(
          "selectCoins: spending eligible address is cheaper than consolidation",
          addressCoins.selection
        );
        return addressCoins.selection;
      }

      coinAddress = eligibleAddresses.shift();
    }

    Log.debug(
      "selectCoins spending from all available UTXOs",
      eligibleCoins.selection
    );
    return eligibleCoins.selection;
  }

  function targetUtxos(utxos, targetAmount) {
    Log.log("targetUtxos trying", utxos, targetAmount);
    const utxoSum = utxos.reduce((sum, utxo) => sum + utxo.valueSatoshis, 0n);
    if (utxoSum < targetAmount) {
      return { selection: [] };
    }

    // try to find the smallest combination of UTXOs (fewer UTXOS moving is better for privacy)
    const selection = [];
    let remainingAmount = targetAmount;

    while (remainingAmount > 0 && utxos.length > 0) {
      const utxo = utxos.shift();
      selection.push(utxo);
      remainingAmount -= utxo.valueSatoshis;
    }

    // negative remainingAmount is change that needs to be returned to wallet
    const changeAmount = remainingAmount * -1n;

    Log.debug("targetUtxos", selection);
    return { selection, changeAmount };
  }

  function discardUtxo(utxo: { tx_hash: string; tx_pos: number }) {
    walletDb.run(`DELETE FROM address_utxos WHERE tx_hash=? AND tx_pos=?;`, [
      utxo.tx_hash,
      utxo.tx_pos,
    ]);
  }

  function discardAddressUtxos(address) {
    walletDb.run(`DELETE FROM address_utxos WHERE address=?;`, [address]);
  }
}

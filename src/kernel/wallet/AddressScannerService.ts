import LogService from "@/kernel/app/LogService";
import ElectrumService from "@/kernel/bch/ElectrumService";
import AddressManagerService, {
  AddressStub,
  AddressEntity,
} from "@/kernel/wallet/AddressManagerService";
import KeyManagerService from "@/kernel/wallet/KeyManagerService";
import UtxoManagerService from "@/kernel/wallet/UtxoManagerService";
import WalletManagerService, {
  WalletEntity,
} from "@/kernel/wallet/WalletManagerService";

import {
  DEFAULT_DERIVATION_PATH,
  DERIVATION_PATHS,
  ValidDerivationPath,
} from "@/util/derivation";

const ADDRESS_GAP_LIMIT = 20; // BIP-44 gap limit is 20
const DERIVATION_SCAN_LIMIT = 5;
const SCAN_BATCH_SIZE = 3000;

const Log = LogService("AddressScanner");

export default function AddressScannerService(wallet: WalletEntity) {
  const Electrum = ElectrumService(wallet.network);
  const WalletManager = WalletManagerService();
  const AddressManager = AddressManagerService(wallet.walletHash);
  const UtxoManager = UtxoManagerService(wallet.walletHash);
  const Hd = KeyManagerService(wallet);

  return {
    populateAddresses,
    scanDerivationPaths,
    scanAddresses,
    scanMoreAddresses,
    rebuildWallet,
    scanHistory,
    scanUtxos,
  };

  // --------------------------------

  // populateAddresses: derive new addresses such that
  // there are always at least $ADDRESS_GAP_LIMIT addresses
  // returns an array of generated addresses
  function populateAddresses(
    n: number = ADDRESS_GAP_LIMIT
  ): Array<AddressEntity> {
    // addresses assumed to be sorted in DESCENDING order by hd_index
    const receiveAddresses = AddressManager.getReceiveAddresses(n);
    const changeAddresses = AddressManager.getChangeAddresses(n);

    // unused addresses assumed to be sorted in ASCENDING order by hd_index
    const unusedReceiveAddresses = AddressManager.getUnusedAddresses(0, 0);
    const unusedChangeAddresses = AddressManager.getUnusedAddresses(0, 1);

    function populate(change: number) {
      const addresses = change ? changeAddresses : receiveAddresses;
      const unusedAddresses = change
        ? unusedChangeAddresses
        : unusedReceiveAddresses;

      const generated: Array<AddressEntity> = [];
      const nAddressesNeeded = n - unusedAddresses.length; // ADDRESS_GAP_LIMIT if no unused addresses

      const startAddress = addresses.shift(); // addresses sorted in descending order
      const startIndex = startAddress ? startAddress.hd_index + 1 : 0; // 0 if no addresses in db
      const endIndex = startIndex + nAddressesNeeded;

      // starting from latest index, generate new addresses
      for (let hd_index = startIndex; hd_index < endIndex; hd_index += 1) {
        const newAddress = Hd.generateAddress(hd_index, change);

        generated.push(
          AddressManager.registerAddress(newAddress, hd_index, change)
        );
      }

      return generated;
    }

    const generatedAddresses = [...populate(0), ...populate(1)];
    Log.debug("populateAddresses", generatedAddresses);
    return generatedAddresses;
  }

  // determine which derivation path to use by scanning each path
  async function scanDerivationPaths(): Promise<ValidDerivationPath> {
    // race all of the available derivation paths
    // first one to resolve with an active address wins
    const activeDerivationPath = await Promise.any(
      DERIVATION_PATHS.map((path) => {
        // set the derivation path for the WalletEntity
        const tempWallet = WalletManager.createTemporaryWallet({
          ...wallet,
          derivation: path,
        });
        const tempHd = KeyManagerService(tempWallet);

        // generate addresses for each change path
        const addresses: Array<string> = [];
        for (let change = 0; change <= 1; change += 1) {
          for (
            let hd_index = 0;
            hd_index < DERIVATION_SCAN_LIMIT;
            hd_index += 1
          ) {
            try {
              const address = tempHd.generateAddress(hd_index, change);
              addresses.push(address);
            } catch (e) {
              Log.error("scanDerivationPaths", e);
            }
          }
        }

        // get states for first n addresses, resolve with path if active
        // if all addresses reject, then path also rejects
        // if all paths reject, error is thrown (return default path)
        return Promise.any(
          addresses.map(async (a) => {
            const addressState = await Electrum.requestAddressState(a);
            return addressState !== null
              ? Promise.resolve(path)
              : Promise.reject();
          })
        );
      })
    ).catch(() => DEFAULT_DERIVATION_PATH);

    return activeDerivationPath;
  }

  async function scanAddresses(
    startIndex = 0,
    endIndex = ADDRESS_GAP_LIMIT,
    change = 0,
    callback: (number) => void = () => {}
  ) {
    Log.time(`scanAddresses ${change}`);
    Log.debug("scanAddresses", startIndex, endIndex, change, wallet.walletHash);

    const walletDb = await WalletManager.openWalletDatabase(wallet.walletHash);

    const dbAddresses = change
      ? AddressManager.getChangeAddresses()
      : AddressManager.getReceiveAddresses();

    // generate addresses within specified hd_index range
    const addresses: Array<AddressStub> = [];
    for (let hd_index = startIndex; hd_index <= endIndex; hd_index += 1) {
      const address = Hd.generateAddress(hd_index, change);
      addresses.push({ address, hd_index, change, state: null });
    }

    // get updated state for all generated addresses
    const addressStubs: Array<AddressStub> = await Promise.all(
      addresses.map(async (a) => {
        let addressState;
        try {
          addressState = await Electrum.requestAddressState(a.address);
        } catch (e) {
          // reset address state to null if request fails
          // null addresses will get re-scanned later
          Log.warn(e);
          addressState = null;
        }

        return { ...a, state: addressState };
      })
    );

    Log.debug("resolved states:", addressStubs);

    // "genesis address" is 0th-index receive address
    const genesisAddress = addressStubs.find(
      (stub) => stub.hd_index === 0 && stub.change === 0
    );

    // no genesis height yet if state is null, set to 0 (it's initialized as null in db)
    // set to zero to mark that the wallet has been synced at least once
    if (genesisAddress && genesisAddress.state === null) {
      WalletManager.setGenesisHeight(wallet.walletHash, 0);
    }

    // filter out all unused addresses
    const activeAddresses = addressStubs.filter((stub) => stub.state !== null);

    // stop now if all addresses are unused (sync complete)
    if (activeAddresses.length === 0) {
      return addressStubs;
    }

    const nullAddresses = addressStubs.filter((stub) => stub.state === null);

    // don't register addresses that are already in db (bulk writes are expensive)
    const checkNeedsRegistration = (stub) =>
      dbAddresses.findIndex((dba) => dba.hd_index === stub.hd_index) === -1;

    // don't register addresses beyond last used address (only fill gaps)
    // populateAddresses will add the unused address buffer later
    const gapAddresses = nullAddresses.filter(
      (stub) =>
        checkNeedsRegistration(stub) &&
        stub.hd_index < activeAddresses[activeAddresses.length - 1].hd_index
    );

    const needsRegistrationAddresses = activeAddresses
      .filter((stub) => checkNeedsRegistration(stub))
      .concat(gapAddresses);

    // for each address with state, register it if we don't have it.
    // [Kludge] We have to use raw SQL here instead of AddressManager.registerAddress
    // [K] so that we can batch all of the writes into one transction for performance
    try {
      if (needsRegistrationAddresses.length > 0) {
        const placeholders = needsRegistrationAddresses
          .map(() => "(?, ?, ?)")
          .join(", ");
        const params = needsRegistrationAddresses.flatMap((stub) => [
          stub.address,
          stub.hd_index,
          stub.change,
        ]);
        walletDb.run(
          `INSERT OR IGNORE INTO addresses (address, hd_index, change) VALUES ${placeholders};`,
          params
        );
      }
    } catch (e) {
      Log.error("scanAddresses:", e);
    }

    // get updated UTXO set for active addresses
    const updatedAddresses = await Promise.allSettled(
      activeAddresses.map((stub) => scanUtxos(stub.address))
    );

    // reset address state for any addresses where utxo fetch failed
    const successAddresses = updatedAddresses
      .map((updated) =>
        updated.status === "fulfilled" ? updated.value.address : null
      )
      .filter((s) => s !== null);

    Log.debug(
      `got UTXOs for ${successAddresses.length} addresses (${activeAddresses.length} attempted)`
    );

    // get history for active addresses
    const stateUpdates = (
      await Promise.allSettled(
        activeAddresses.map((stub) => {
          if (!successAddresses.includes(stub.address)) {
            Log.warn(stub.address, "failed getting UTXOs");
            return Promise.resolve([stub.address, null]);
          }

          const calculatedState = AddressManager.calculateAddressState(
            stub.address
          );

          // if states match, address does not need update
          if (calculatedState !== stub.state) {
            return scanHistory(stub.address, callback, true);
          }

          callback(1);
          return Promise.resolve([stub.address, calculatedState]);
        })
      )
    ).map((settled) => (settled.status === "fulfilled" ? settled.value : null));

    try {
      const validUpdates = stateUpdates.filter(Array.isArray);
      // 3 params per row; SQLite limit is 999 variables
      const BATCH_SIZE = 333;
      for (let i = 0; i < validUpdates.length; i += BATCH_SIZE) {
        const batch = validUpdates.slice(i, i + BATCH_SIZE);
        const setClauses = batch.map(() => "WHEN ? THEN ?").join(" ");
        const whereIn = batch.map(() => "?").join(", ");
        const params = [
          ...batch.flatMap((u) => [u[0], u[1]]),
          ...batch.map((u) => u[0]),
        ];
        walletDb.run(
          `UPDATE addresses SET state = CASE address ${setClauses} END WHERE address IN (${whereIn});`,
          params
        );
      }
    } catch (e) {
      Log.error("scanAddresses:", e);
    }

    Log.debug(
      "Scanned",
      addressStubs.length,
      "Active",
      activeAddresses.length,
      "Null",
      nullAddresses.length
    );

    Log.timeEnd(`scanAddresses ${change}`);
    return addressStubs;
  }

  async function scanMoreAddresses(
    nScanMore: number = ADDRESS_GAP_LIMIT,
    change: number = 0,
    callback: (number) => void = () => {}
  ) {
    // addresses assumed to be sorted in DESCENDING order by hd_index
    const addresses = change
      ? AddressManager.getChangeAddresses()
      : AddressManager.getReceiveAddresses();

    // unused addresses assumed to be sorted in ASCENDING order by hd_index
    const firstUnused = AddressManager.getUnusedAddresses(1, change)[0] || null;
    const lastAddress = addresses[0] || null;

    // lastAddress is null on wallet init (no addresses generated yet)
    const scanEndIndex =
      (lastAddress !== null ? lastAddress.hd_index : 0) + nScanMore;

    // start scan from first unused address index, not latest (rechecks gaps)
    const scanStartIndex =
      firstUnused !== null ? firstUnused.hd_index : scanEndIndex - nScanMore; // 0 + nScanMore - nScanMore

    Log.debug(
      "scanMoreAddresses",
      nScanMore,
      scanStartIndex,
      scanEndIndex,
      firstUnused
    );

    const scannedAddresses = await scanAddresses(
      scanStartIndex,
      scanEndIndex,
      change,
      callback
    );

    return scannedAddresses;
  }

  async function rebuildWallet(callback: (number) => void = () => {}) {
    Log.debug("Starting Wallet Rebuild");
    Log.time("rebuildWallet");

    const getUnusedCount = (addresses) =>
      addresses.filter((a) => a.state === null).length;

    try {
      WalletManager.clearWalletData(wallet.walletHash);

      /* eslint-disable no-await-in-loop */
      for (let change = 0; change <= 1; change += 1) {
        let addresses = await scanMoreAddresses(
          SCAN_BATCH_SIZE,
          change,
          callback
        );

        while (getUnusedCount(addresses) < ADDRESS_GAP_LIMIT) {
          addresses = await scanMoreAddresses(
            SCAN_BATCH_SIZE,
            change,
            callback
          );
        }
      }
      /* eslint-enable no-await-in-loop */

      // restore memos and historical fiat amounts
      WalletManager.restoreWalletData(wallet.walletHash);

      await WalletManager.saveWallet(wallet.walletHash);
      Log.debug("Wallet Rebuild Done");
    } catch (e) {
      WalletManager.setGenesisHeight(wallet.walletHash, null);
      Log.warn("Wallet Rebuild Failed!", e);
    } finally {
      Log.timeEnd("rebuildWallet");
    }
  }

  async function scanUtxos(address: string) {
    const remoteUtxos = await Electrum.requestUtxos(address);

    if (!Array.isArray(remoteUtxos)) {
      throw remoteUtxos;
    }

    // re-registering UTXOs is time-expensive, so diff against existing utxo set
    const remoteUtxoList = remoteUtxos
      .map((utxo) => `${utxo.tx_hash}:${utxo.tx_pos}`)
      .sort();

    const localUtxos = UtxoManager.getAddressUtxos(address);
    const localUtxoList = localUtxos
      .map((utxo) => `${utxo.tx_hash}:${utxo.tx_pos}`)
      .sort();

    const utxoDiffIn = remoteUtxoList.reduce(
      (diff, utxo) => (localUtxoList.includes(utxo) ? diff : [...diff, utxo]),
      [] as Array<string>
    );

    const utxoDiffOut = localUtxoList.reduce(
      (diff, utxo) => (remoteUtxoList.includes(utxo) ? diff : [...diff, utxo]),
      [] as Array<string>
    );

    if (localUtxoList.join(";") !== remoteUtxoList.join(";")) {
      Log.debug("got utxos", address, remoteUtxos);
      //Log.debug("diff", utxoDiffIn, utxoDiffOut);

      // we need to delete our knowledge of UTXO set
      // in case some utxos were spent elsewhere
      // i.e. wallet seed shared on multiple devices
      UtxoManager.discardAddressUtxos(address);

      remoteUtxos.forEach((utxo) => {
        UtxoManager.registerUtxo(utxo);
        /*
        // TODO: validate that the UTXOs pass merkle inclusion
        // for now we just trust that fulcrum isn't lying to us
        listenerApi.dispatch(syncBlock(utxo.height));
        listenerApi.dispatch(syncTxRequest(utxo.tx_hash));
        */
      });
    }

    return { address, diffIn: utxoDiffIn, diffOut: utxoDiffOut };
  }

  async function scanHistory(
    address: string,
    callback: (number) => void = () => {},
    batch = false
  ) {
    const walletDb = await WalletManager.openWalletDatabase(wallet.walletHash);

    const history = await Electrum.requestAddressHistory(address);
    const transactions = await Promise.all(
      history.map(async (historyTx) => {
        const merkle = await Electrum.requestMerkle(
          historyTx.tx_hash,
          historyTx.height
        );

        // TODO: verify merkles

        return {
          address,
          ...historyTx,
          block_pos: merkle.pos || null,
        };
      })
    );

    AddressManager.registerTransactions(transactions);

    const newCalculatedState = AddressManager.calculateAddressState(address);

    // set wallet genesis height based on first received transaction
    const genesisAddress = AddressManager.getAddressRange(0, 0, 0)[0];
    if (address === genesisAddress.address) {
      const genesisHeight = history.reduce((lowest, cur) => {
        if (lowest === 0) {
          return cur.height;
        }

        return cur.height > 0 && cur.height < lowest ? cur.height : lowest;
      }, 0);

      //Log.debug("genesisAddress", genesisAddress, genesisHeight);
      WalletManager.setGenesisHeight(wallet.walletHash, genesisHeight);
    }

    try {
      if (!batch) {
        walletDb.run(
          `UPDATE addresses SET 
          state=$state
        WHERE address=$address;
      `,
          { $state: newCalculatedState, $address: address }
        );
      }
    } catch (e) {
      Log.error("scanHistory", e);
      return Promise.resolve([address, null]);
    }

    //Log.debug("scanHistory", address, newCalculatedState);
    callback(1);
    return Promise.resolve([address, newCalculatedState]);
  }
}

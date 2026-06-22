import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import {
  binToBase64,
  IdentityHistory,
  IdentitySnapshot,
  importMetadataRegistry,
  MetadataRegistry,
  RegistryTimestampKeyedValues,
} from "@bitauth/libauth";
import { DateTime } from "luxon";

import DatabaseService from "@/kernel/app/DatabaseService";
import LogService from "@/kernel/app/LogService";
import ElectrumService from "@/kernel/bch/ElectrumService";
import TransactionManagerService, {
  TransactionEntity,
} from "@/kernel/bch/TransactionManagerService";

import { sha256 } from "@/util/hash";
import { hexToUtf8 } from "@/util/hex";
import { ipfsFetch } from "@/util/ipfs";
import { detectImageMime } from "@/util/mime";
import { ValidBchNetwork } from "@/util/network";
import { resolveNftType } from "@/util/token";
import bcmrLocal from "@/assets/bcmr-selene-local.json";

const Log = LogService("BcmrService");

interface LocalMetadataRegistry extends MetadataRegistry {
  identities: RegistryTimestampKeyedValues<IdentityHistory>;
}

class BcmrRefreshError extends Error {
  uri;

  constructor(uri) {
    super();
    this.uri = uri;
  }
}

const LOCAL_BCMR = importMetadataRegistry(bcmrLocal) as LocalMetadataRegistry;

const ICON_CACHE = new Map();

interface BcmrMeta extends MetadataRegistry {
  authbase: string;
  registryUri: string;
  lastFetch: string;
}

interface IdentityRegistry {
  registry: MetadataRegistry;
  registryHash: string;
  registryMeta: BcmrMeta;
}

function getDefaultRegistryUri(authbase: string): string {
  const registryUri = `https://bcmr.paytaca.com/api/registries/${authbase}/latest`;
  return registryUri;
}

export default function BcmrService(bchNetwork: ValidBchNetwork) {
  const Database = DatabaseService();
  const APP_DB = Database.getAppDatabase();

  const BCMR_MAGIC = "6a0442434d52"; // OP_RETURN BCMR

  return {
    extractIdentity,
    resolveIdentityRegistry,
    resolveAuthChain,
    resolveIcon,
    getCategoryAuthbase,
    purgeBcmrData,
    exportLocalBcmr,
    preloadMetadataRegistries,
  };

  // --------------------------------

  async function _importBcmrFile(
    bcmrId = "selene-local"
  ): Promise<MetadataRegistry> {
    const bcmrFile = await Filesystem.readFile({
      path: `/selene/bcmr/bcmr-${bcmrId}.json`,
      directory: Directory.Library,
      encoding: Encoding.UTF8,
    });

    const bcmr = importMetadataRegistry(bcmrFile.data);

    if (typeof bcmr === "string") {
      throw new Error(bcmr);
    }

    //Log.debug("importBcmrFile", bcmr);
    return bcmr;
  }

  async function _writeBcmrFile(
    bcmrId = "selene-local",
    bcmr: MetadataRegistry = LOCAL_BCMR
  ): Promise<void> {
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    const result = await Filesystem.writeFile({
      path: `/selene/bcmr/bcmr-${bcmrId}.json`,
      directory: Directory.Library,
      encoding: Encoding.UTF8,
      data: JSON.stringify(bcmr),
    });

    //Log.debug("writeBcmrFile", result, bcmr);
  }

  // --------------------------------

  // extractIdentity: get the current IdentitySnapshot for an authbase from a Registry
  // defaults to local master registry
  function extractIdentity(
    authbase: string,
    bcmr: MetadataRegistry = LOCAL_BCMR
  ): IdentitySnapshot {
    const snapshots = bcmr.identities ? bcmr.identities[authbase] : null;

    if (!snapshots) {
      throw new Error(`No identity for authbase ${authbase}`);
    }

    const kSnapshots = Object.keys(snapshots).sort().reverse();
    const latestSnapshotTimestamp = kSnapshots.shift();

    if (!latestSnapshotTimestamp) {
      throw new Error(`No identity for authbase ${authbase}`);
    }

    const latestSnapshot = snapshots[latestSnapshotTimestamp];
    const now = DateTime.now();
    let migrated = latestSnapshot.migrated
      ? DateTime.fromISO(latestSnapshot.migrated)
      : DateTime.fromISO(latestSnapshotTimestamp);

    let currentSnapshot: IdentitySnapshot = latestSnapshot;
    let currentSnapshotTimestamp = latestSnapshotTimestamp;

    // if an identity is scheduled to migrate, make sure we return the current data, not latest
    while (migrated > now) {
      currentSnapshotTimestamp = kSnapshots.shift() || currentSnapshotTimestamp;
      currentSnapshot = snapshots[currentSnapshotTimestamp];

      if (!currentSnapshot.migrated || kSnapshots.length === 0) {
        break;
      }

      migrated = DateTime.fromISO(currentSnapshot.migrated);
    }

    //Log.debug("extractIdentity", authbase, currentSnapshot);
    return currentSnapshot;
  }

  // --------------------------------

  // loadIdentityRegistry: reads identity data from filesystem and app database
  async function loadIdentityRegistry(
    authbase: string
  ): Promise<IdentityRegistry> {
    const result = APP_DB.exec("SELECT * FROM bcmr WHERE authbase=?", [
      authbase,
    ]);

    if (result.length < 1) {
      throw new Error(`No registry for authbase ${authbase}`);
    }

    const registryMeta = result[0];
    const registry = await _importBcmrFile(authbase);
    const registryHash = sha256.text(JSON.stringify(registry));

    const identityRegistry = {
      registry,
      registryHash,
      registryMeta,
    };

    //Log.debug("loadIdentityRegistry", authbase, identityRegistry);
    mergeRegistry(registry);
    return identityRegistry;
  }

  // commitIdentityRegistry: writes identity data to filesystem and app database
  async function commitIdentityRegistry(
    authbase: string,
    registry: MetadataRegistry,
    registryUri: string
  ): Promise<IdentityRegistry> {
    await _writeBcmrFile(authbase, registry);

    const registryMeta = APP_DB.exec(
      `INSERT INTO bcmr (authbase, registryUri) 
        VALUES ($authbase, $registryUri)
        ON CONFLICT(authbase) DO
          UPDATE SET
            lastFetch=strftime('%Y-%m-%dT%H:%M:%SZ'),
            registryUri=$registryUri
        RETURNING *;`,
      { $authbase: authbase, $registryUri: registryUri }
    )[0];

    const registryHash = sha256.text(JSON.stringify(registry));

    const identityRegistry = { registry, registryHash, registryMeta };

    Log.debug("commitIdentityRegistry", authbase, identityRegistry);
    mergeRegistry(registry);

    return identityRegistry;
  }

  // --------------------------------

  function getCategoryAuthbase(category: string): string {
    const result = APP_DB.exec(
      "SELECT authbase FROM bcmr_tokens WHERE category=?",
      [category]
    );

    return result.length > 0 ? result[0].authbase : category;
  }

  async function preloadMetadataRegistries() {
    const authbases = APP_DB.exec("SELECT authbase FROM bcmr");

    //Log.debug("preloadMetadataRegistries", authbases);

    return Promise.allSettled(
      authbases.map(({ authbase }) => loadIdentityRegistry(authbase))
    );
  }

  async function resolveIdentityRegistry(
    authbase: string,
    _registryUri?: string,
    isAuthchainResolved: boolean = false
  ) {
    const registryUri = _registryUri || getDefaultRegistryUri(authbase);

    try {
      const identityRegistry = await loadIdentityRegistry(authbase);
      const { registryMeta } = identityRegistry;
      if (
        DateTime.fromISO(registryMeta.lastFetch).plus({ days: 7 }) <
          DateTime.now() ||
        (registryMeta.registryUri !== registryUri && _registryUri !== undefined)
      ) {
        Log.warn("invalidate-cache", registryUri, registryMeta.registryUri);
        throw new BcmrRefreshError(registryMeta.registryUri);
      }
      //Log.debug("resolveIdentityRegistry got", identityRegistry);
      return identityRegistry;
    } catch (e) {
      const uri = e instanceof BcmrRefreshError ? e.uri : registryUri;
      Log.debug("fetching identity registry from", uri);
      const response = await ipfsFetch(uri);
      const responseData = await response.json();

      const importedRegistry = importMetadataRegistry(responseData);

      if (typeof importedRegistry === "string") {
        throw new Error(importedRegistry);
      }

      /*const importedRegistryHash = sha256.text(
        JSON.stringify(importedRegistry)
        );*/

      // immediately upgrade to on-chain resolution if applicable
      if (
        typeof importedRegistry.registryIdentity === "string" &&
        !isAuthchainResolved
      ) {
        const authChainRegistry = await resolveAuthChainRegistry(
          importedRegistry.registryIdentity
        );

        if (!authChainRegistry) {
          Log.warn("No authChainRegistry?", importedRegistry.registryIdentity);
        }

        /*onst authChainRegistryHash = sha256.text(
          JSON.stringify(authChainRegistry.registry)
          );*/

        if (authChainRegistry) {
          const identityRegistry = await commitIdentityRegistry(
            authbase,
            authChainRegistry.registry,
            authChainRegistry.registryMeta.registryUri
          );

          return identityRegistry;
        }
      }

      if (!importedRegistry.identities) {
        throw new Error(
          `No identities resolved for authbase ${authbase} @ ${registryUri}`
        );
      }

      /*const importedIdentity = extractIdentity(authbase, importedRegistry);

      importedIdentity.extensions = Object.assign(
        {},
        importedRegistry.extensions,
        importedIdentity.extensions
      );*/

      const identityRegistry = await commitIdentityRegistry(
        authbase,
        importedRegistry,
        registryUri
      );

      //Log.debug("resolveIdentityRegistry resolved", identityRegistry);
      return identityRegistry;
    }
  }

  // --------------------------------

  async function resolveAuthChain(authbase: string) {
    const TransactionManager = TransactionManagerService();
    const Electrum = ElectrumService();

    const chain = [] as TransactionEntity[];
    let nextTxHash = authbase;

    Log.debug("resolveAuthChain", authbase);

    /* eslint-disable no-await-in-loop */
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      const nextTx = await TransactionManager.resolveTransaction(
        nextTxHash,
        bchNetwork
      );
      chain.push(nextTx);

      // check if output 0 is unspent (authHead condition)
      const identityUtxo = await Electrum.requestUtxoInfo(nextTxHash, 0);
      if (identityUtxo !== null) {
        Log.debug(
          "resolveAuthChain found authHead utxo",
          identityUtxo,
          nextTxHash
        );

        //Log.debug("resolveAuthChain got", identityUtxo, chain);
        return chain;
      }

      const { addresses: txAddresses } = nextTx.vout[0].scriptPubKey;

      // if output 0 is OP_RETURN, identity is considered "burned"
      const isOpReturn =
        nextTx.vout[0].scriptPubKey.asm.startsWith("OP_RETURN");

      if (isOpReturn || !txAddresses) {
        Log.warn(
          `Identity burned? Found OP_RETURN at vout[0] in ${nextTxHash}`,
          nextTx.vout[0],
          authbase
        );
        return chain;
      }

      const address = txAddresses[0];
      const addressHistory = await Electrum.requestAddressHistory(
        address,
        nextTx.height
      );

      if (!Array.isArray(addressHistory)) {
        Log.warn(`No address history for authchain?`);
        return chain;
      }

      const findMatchTxid = async (htx, findHash) => {
        const { vin } = await TransactionManager.resolveTransaction(
          htx.tx_hash,
          bchNetwork
        );
        const matchUtxo = vin.find(
          (vn) => vn.tx_hash === findHash && vn.vout === 0
        );

        if (!matchUtxo) {
          return Promise.reject();
        }

        return Promise.resolve(htx.tx_hash);
      };

      const findHash = nextTxHash;
      const promises = addressHistory.map((htx) =>
        findMatchTxid(htx, findHash)
      );

      try {
        nextTxHash = await Promise.any(promises);
        //Log.debug("Found next transaction in chain", nextTxHash);
      } catch (error) {
        // if no transaction spends output 0, this might indicate an error or incomplete history
        Log.error("No spending transaction found for", nextTxHash, error);
        throw new Error(
          `Authchain resolution failed: No spending transaction found for ${nextTxHash}`
        );
      }
    }
    /* eslint-enable no-await-in-loop */
  }

  async function resolveAuthChainRegistry(authbase: string) {
    try {
      const authchain = await resolveAuthChain(authbase);

      //Log.debug("resolveAuthChainRegistry got authchain", authbase);
      let latestBcmrOutput;

      authchain.forEach((tx) => {
        const bcmrOutput = findBcmrOutput(tx);
        latestBcmrOutput = bcmrOutput || latestBcmrOutput;
      });

      if (!latestBcmrOutput) {
        throw new Error(`No BCMR in authchain for ${authbase}`);
      }

      /*Log.debug(
        "resolveAuthChainRegistry latestBcmrOutput",
        authbase,
        latestBcmrOutput.scriptPubKey.asm
        );*/

      const { uris: registryUris } = parseBcmrOutput(
        latestBcmrOutput.scriptPubKey.hex
      );

      //Log.debug("Authhead got uri:", registryUris, registryHash);
      return await resolveIdentityRegistry(authbase, registryUris[0], true);
    } catch (e) {
      Log.error(e);
      return null;
    }
  }

  function findBcmrOutput(transaction) {
    const bcmrOutput = transaction.vout.find((out) =>
      out.scriptPubKey.hex.startsWith(BCMR_MAGIC)
    );

    return bcmrOutput;
  }

  function parseBcmrOutput(vout_hex: string) {
    let cursor = vout_hex.indexOf(BCMR_MAGIC);

    // OP_RETURN BCMR
    const magicSlice = vout_hex.slice(cursor, BCMR_MAGIC.length);
    cursor += magicSlice.length;

    // OP_PUSHBYTES_32
    cursor += 2;

    // <hash> (32 bytes)
    const hashSlice = vout_hex.slice(cursor, cursor + 64);
    const hash = hexToUtf8(hashSlice);
    cursor += hashSlice.length;

    const uris: Array<string> = [];
    while (cursor < vout_hex.length) {
      // OP_PUSHBYTES_...
      let pushSlice = vout_hex.slice(cursor, cursor + 2);
      cursor += pushSlice.length;

      // ...PUSHBYTES_1
      if (pushSlice === "4c") {
        pushSlice = vout_hex.slice(cursor, cursor + 2);
        cursor += pushSlice.length;
      }

      // ...PUSHBYTES_2
      if (pushSlice === "4d") {
        pushSlice = vout_hex.slice(cursor, cursor + 4);
        cursor += pushSlice.length;
      }

      // ...PUSHBYTES_4
      if (pushSlice === "4e") {
        pushSlice = vout_hex.slice(cursor, cursor + 8);
        cursor += pushSlice.length;
      }

      const nPush = Number.parseInt(pushSlice, 16) * 2;

      // <uri>
      const uriSlice = vout_hex.slice(cursor, cursor + nPush);
      const uri = hexToUtf8(uriSlice);
      uris.push(uri);
      cursor += uriSlice.length;
    }

    Log.debug("parseBcmrOutput", magicSlice, hashSlice, uris);

    return { hash, uris };
  }

  // --------------------------------

  function mergeRegistry(registry) {
    const incomingIdentities = Object.keys(registry.identities);
    incomingIdentities.forEach((authbase) => {
      const bcmrIdentity = LOCAL_BCMR.identities[authbase] || {};
      const registryIdentity = registry.identities[authbase] || {};

      const newBcmrIdentity = {
        ...bcmrIdentity,
        ...registryIdentity,
      };

      const hashedBcmrIdentity = sha256.text(JSON.stringify(bcmrIdentity));
      const hashedNewIdentity = sha256.text(JSON.stringify(newBcmrIdentity));

      if (hashedNewIdentity !== hashedBcmrIdentity) {
        LOCAL_BCMR.identities[authbase] = newBcmrIdentity;
        LOCAL_BCMR.version.patch += LOCAL_BCMR.version.patch;
        LOCAL_BCMR.latestRevision = new Date().toISOString();

        /*Log.debug(
          "mergeRegistry",
          bcmrIdentity,
          registryIdentity,
          newBcmrIdentity,
          LOCAL_BCMR
          );*/
      }
    });
  }

  function exportLocalBcmr() {
    const validBcmr = importMetadataRegistry(LOCAL_BCMR);

    if (typeof validBcmr === "string") {
      throw new Error(validBcmr);
    }

    Log.info(validBcmr);
  }

  async function purgeBcmrData() {
    const bcmrFiles = (
      await Filesystem.readdir({
        path: "/selene/bcmr",
        directory: Directory.Library,
      })
    ).files;

    const bcmrIconFiles = (
      await Filesystem.readdir({
        path: "/selene/icons",
        directory: Directory.Cache,
      })
    ).files;

    const bcmrImageFiles = (
      await Filesystem.readdir({
        path: "/selene/images",
        directory: Directory.Cache,
      })
    ).files;

    Log.time("purgeBcmrData");
    await Promise.all([
      ...bcmrIconFiles.map((file) =>
        Filesystem.deleteFile({
          path: `/selene/icons/${file.name}`,
          directory: Directory.Cache,
        })
      ),
      ...bcmrImageFiles.map((file) =>
        Filesystem.deleteFile({
          path: `/selene/images/${file.name}`,
          directory: Directory.Cache,
        })
      ),
      ...bcmrFiles.map((file) =>
        Filesystem.deleteFile({
          path: `/selene/bcmr/${file.name}`,
          directory: Directory.Library,
        })
      ),
    ]);

    APP_DB.exec("DELETE FROM bcmr; DELETE FROM bcmr_tokens;");
    await Database.flushDatabase("app");
    Log.timeEnd("purgeBcmrData");
  }

  async function resolveIcon(
    authbase: string,
    nft_commitment?: string,
    returnImage?: boolean
  ) {
    let iconBase64;
    let iconDataUri;
    let identity;
    try {
      identity = extractIdentity(authbase);
    } catch (e) {
      return null;
    }
    const parsed = resolveNftType(
      identity.token?.nfts,
      nft_commitment,
      authbase
    );
    const hasNftMetadata = parsed.isSuccess && !!parsed.nftType;
    const identityNft = parsed.nftType || null;

    const hasUris = !!identity.uris;
    const hasIcon = hasUris && identity.uris.icon;
    const hasImage = hasUris && identity.uris.image;

    const hasNftUris = hasNftMetadata && identityNft && identityNft.uris;
    const hasNftIcon = hasNftMetadata && hasNftUris && identityNft.uris.icon;
    const hasNftImage = hasNftMetadata && hasNftUris && identityNft.uris.image;

    // Use typeId for cache key so all NFTs of the same type share one icon
    const filename = hasNftMetadata
      ? sha256.text(`${authbase}${parsed.typeId}`)
      : authbase;

    const dir = returnImage ? "images" : "icons";
    const iconPath = `${dir}/${filename}`;

    if (ICON_CACHE.has(iconPath)) {
      const cachedIcon = ICON_CACHE.get(iconPath);
      if (cachedIcon !== null) {
        return cachedIcon;
      }
    }

    try {
      iconBase64 = (
        await Filesystem.readFile({
          path: `/selene/${iconPath}`,
          directory: Directory.Cache,
        })
      ).data;

      const mime = detectImageMime(iconBase64);
      if (mime === null) {
        // Cached file may use old encoding format; delete and re-fetch
        await Filesystem.deleteFile({
          path: `/selene/${iconPath}`,
          directory: Directory.Cache,
        }).catch(() => {});
        throw new Error("Invalid cached icon format");
      }
      iconDataUri = `data:${mime};base64,${iconBase64}`;
    } catch (e) {
      // Prefer NFT type URIs, fall back to category URIs
      const shouldPreferNftUri =
        hasNftMetadata && hasNftUris && (hasNftIcon || hasNftImage);

      if (!shouldPreferNftUri && !hasIcon && !hasImage) {
        ICON_CACHE.set(iconPath, null);
        return null;
      }

      const fetchUri = decodeURI(
        /* eslint-disable-next-line no-nested-ternary */
        shouldPreferNftUri
          ? (returnImage && hasNftImage) || (!hasNftIcon && hasNftImage)
            ? identityNft.uris.image
            : identityNft.uris.icon
          : (returnImage && hasImage) || (!hasIcon && hasImage)
            ? identity.uris.image
            : identity.uris.icon
      );

      if (fetchUri.startsWith("data:")) {
        iconDataUri = fetchUri;
      } else {
        try {
          const response = await ipfsFetch(fetchUri);
          const iconBuffer = await response.arrayBuffer();
          const iconBytes = new Uint8Array(iconBuffer);
          const iconData = binToBase64(iconBytes);

          const { uri: iconUri } = await Filesystem.writeFile({
            path: `/selene/${dir}/${filename}`,
            directory: Directory.Cache,
            data: iconData,
          });

          const { data } = await Filesystem.readFile({
            path: iconUri,
          });

          iconBase64 = data;
          const mime = detectImageMime(iconBase64);
          iconDataUri = `data:${mime};base64,${iconBase64}`;
        } catch (fetchError) {
          Log.warn(fetchError);

          ICON_CACHE.set(iconPath, null);
          return null;
        }
      }
    }

    ICON_CACHE.set(iconPath, iconDataUri);
    return iconDataUri;
  }
}

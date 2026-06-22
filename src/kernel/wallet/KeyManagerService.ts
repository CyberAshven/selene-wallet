import {
  assertSuccess,
  bigIntToCompactUint,
  binToBase64,
  CashAddressType,
  CompilationContextBCH,
  deriveHdPath,
  deriveHdPrivateNodeChild,
  deriveHdPrivateNodeFromSeed,
  deriveSeedFromBip39Mnemonic,
  encodeCashAddress,
  encodeLockingBytecodeP2pkh,
  generateSigningSerializationBCH,
  importWalletTemplate,
  secp256k1,
  SigningSerializationFlag,
  utf8ToBin,
  walletTemplateP2pkhNonHd,
  walletTemplateToCompilerBCH,
} from "@bitauth/libauth";

import AddressManagerService from "@/kernel/wallet/AddressManagerService";
import WalletManagerService, {
  WalletStub,
} from "@/kernel/wallet/WalletManagerService";

import { convertCashAddress } from "@/util/cashaddr";
import { ripemd160, sha256 } from "@/util/hash";
import { binToHex, hexToBin } from "@/util/hex";
import { utxoToTokenPrefix } from "@/util/normalize";

const seedCache = new Map();

// Note: Map.clear() releases references but does NOT zero the seed bytes in
// V8 heap memory. JavaScript provides no reliable way to overwrite GC-managed
// memory. On native platforms, key material is zeroed via memset_s (iOS) and
// ByteArray.fill(0) (Android). This JS-side clear is best-effort only.
export function clearSeedCache() {
  seedCache.forEach((seed) => {
    if (seed instanceof Uint8Array) seed.fill(0);
  });
  seedCache.clear();
}

export default function KeyManagerService(walletStub: WalletStub) {
  const WalletManager = WalletManagerService();
  const walletHash = WalletManager.calculateWalletHash(walletStub);
  const { mnemonic, derivation, passphrase } = walletStub;

  // deriveSeedFromBip39Mnemonic is expensive (according to profiling)
  // so we make sure we only run once per seed material
  let seed = seedCache.get(walletHash);
  if (!seed) {
    seed = deriveSeedFromBip39Mnemonic(mnemonic, { passphrase });
    seedCache.set(walletHash, seed);
  }

  const hdMaster = deriveHdPrivateNodeFromSeed(seed);
  const hdMain = deriveHdPath(hdMaster, `${derivation}/0`);
  const hdChange = deriveHdPath(hdMaster, `${derivation}/1`);

  const walletPrefix = WalletManager.getPrefix();

  return {
    generateAddress,
    signInputs,
    signMessage,
    signTemplate,
    getAddressPrivateKey: _deriveAddressPrivateKey,
  };

  // raw address generation function
  function generateAddress(index, change = 0) {
    const child = deriveHdPrivateNodeChild(change ? hdChange : hdMain, index);

    const pubKey = secp256k1.derivePublicKeyCompressed(child.privateKey);

    if (typeof pubKey === "string") {
      throw new Error(pubKey);
    }

    const hash = ripemd160.hash(sha256.hash(pubKey));
    const { address } = encodeCashAddress({
      prefix: walletPrefix,
      type: CashAddressType.p2pkh,
      payload: hash,
      throwErrors: true,
    });

    //Log.debug("generateAddress", index, address);
    return address;
  }

  function _deriveAddressPrivateKey(address: string) {
    const AddressManager = AddressManagerService(walletHash);
    const { hd_index, change } = AddressManager.getAddress(
      convertCashAddress(address, "cashaddr")
    );

    const { privateKey } = deriveHdPrivateNodeChild(
      change ? hdChange : hdMain,
      hd_index
    );

    return privateKey;
  }

  function signInputs(inputs, compiler) {
    return inputs.map((input) => ({
      outpointTransactionHash: hexToBin(input.tx_hash),
      outpointIndex: input.tx_pos,
      sequenceNumber: 0,
      unlockingBytecode: {
        compiler,
        script: "unlock",
        valueSatoshis: input.valueSatoshis,
        data: {
          keys: {
            privateKeys: {
              key: _deriveAddressPrivateKey(input.address), // [!]
            },
          },
        },
        token: utxoToTokenPrefix(input),
      },
    }));
  }

  function signMessage(payload: string, address: string) {
    const privateKey = _deriveAddressPrivateKey(address);

    const magic = `\x18Bitcoin Signed Message:\n`;
    const messageBytes = utf8ToBin(payload);
    const preimage = new Uint8Array([
      ...utf8ToBin(magic),
      ...bigIntToCompactUint(BigInt(messageBytes.length)),
      ...messageBytes,
    ]);
    const messageHash = sha256.hash(sha256.hash(preimage));

    const recoverable = secp256k1.signMessageHashRecoverableCompact(
      privateKey,
      messageHash
    );

    if (typeof recoverable === "string") {
      throw new Error(recoverable);
    }

    const signature = new Uint8Array([
      ...[31 + recoverable.recoveryId],
      ...recoverable.signature,
    ]);

    const base64Signature = binToBase64(signature);
    //Log.log("signMessage", address, base64Signature, payload);

    return base64Signature;
  }

  function signTemplate(template, sourceOutputs, address) {
    const privateKey = _deriveAddressPrivateKey(address);
    const pubkeyCompressed = assertSuccess(
      secp256k1.derivePublicKeyCompressed(privateKey)
    );
    const pubkeyHash = ripemd160.hash(sha256.hash(pubkeyCompressed));
    const walletLockingBytecodeHex = binToHex(
      encodeLockingBytecodeP2pkh(pubkeyHash)
    );
    const unsignedTransaction = { ...template };

    const walletTemplate = importWalletTemplate(walletTemplateP2pkhNonHd);

    if (typeof walletTemplate === "string") {
      throw new Error(walletTemplate);
    }

    const compiler = walletTemplateToCompilerBCH(walletTemplate);

    /* eslint-disable prefer-template */
    /* eslint-disable no-bitwise */
    /* eslint-disable-next-line no-restricted-syntax */
    for (const [index, input] of template.inputs.entries()) {
      const correspondingSourceOutput = sourceOutputs[index];

      if (correspondingSourceOutput.contract?.artifact?.contractName) {
        // replace pubkey and sig placeholders
        let unlockingBytecodeHex = binToHex(
          correspondingSourceOutput.unlockingBytecode
        );
        const sigPlaceholder = "41" + binToHex(Uint8Array.from(Array(65)));
        const pubkeyPlaceholder = "21" + binToHex(Uint8Array.from(Array(33)));
        if (unlockingBytecodeHex.indexOf(sigPlaceholder) !== -1) {
          // compute the signature argument
          const hashType =
            SigningSerializationFlag.allOutputs |
            SigningSerializationFlag.utxos |
            SigningSerializationFlag.forkId;
          const context: CompilationContextBCH = {
            inputIndex: index,
            sourceOutputs,
            transaction: unsignedTransaction,
          };
          const signingSerializationType = new Uint8Array([hashType]);

          const coveredBytecode =
            correspondingSourceOutput.contract?.redeemScript;
          if (!coveredBytecode) {
            throw new Error(
              "Not enough information provided, please include contract redeemScript"
            );
          }
          const sighashPreimage = generateSigningSerializationBCH(context, {
            coveredBytecode,
            signingSerializationType,
          });
          const sighash = sha256.hash(sha256.hash(sighashPreimage));
          const signature = secp256k1.signMessageHashSchnorr(
            privateKey,
            sighash
          );
          if (typeof signature === "string") {
            throw new Error("Signature error: " + signature);
          }
          const sig = Uint8Array.from([...signature, hashType]);

          unlockingBytecodeHex = unlockingBytecodeHex.replace(
            sigPlaceholder,
            "41" + binToHex(sig)
          );
        }
        if (unlockingBytecodeHex.indexOf(pubkeyPlaceholder) !== -1) {
          unlockingBytecodeHex = unlockingBytecodeHex.replace(
            pubkeyPlaceholder,
            "21" + binToHex(pubkeyCompressed)
          );
        }

        input.unlockingBytecode = hexToBin(unlockingBytecodeHex);
      } else {
        // replace unlocking bytecode for placeholder unlockers matching the wallet locking bytecode
        const inputLockingBytecodeHex = binToHex(
          correspondingSourceOutput.lockingBytecode
        );
        if (
          !correspondingSourceOutput.unlockingBytecode?.length &&
          inputLockingBytecodeHex === walletLockingBytecodeHex
        ) {
          input.unlockingBytecode = {
            compiler,
            data: {
              keys: { privateKeys: { key: privateKey } },
            },
            valueSatoshis: correspondingSourceOutput.valueSatoshis,
            script: "unlock",
            token: correspondingSourceOutput.token,
          };
        }
      }
    }

    return template;
  }
}

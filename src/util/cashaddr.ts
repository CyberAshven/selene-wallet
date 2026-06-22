import {
  assertSuccess,
  base58AddressToLockingBytecode,
  cashAddressToLockingBytecode,
  CashAddressType,
  decodeBase58Address,
  decodeCashAddress,
  encodeBase58Address,
  encodeCashAddress,
} from "@bitauth/libauth";

import { validateBip21Uri } from "@/util/uri";

// Regex patterns for detecting potential BCH addresses/URIs embedded in text
// Legacy: starts with 1 or 3, followed by base58 chars
// Cashaddr: optional prefix, then q/p/z/r followed by bech32 chars, optional BIP21 query
const bchAddressPatterns = {
  legacy: /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/g,
  cashaddr:
    /(?:(?:bitcoincash|bchtest|bchreg):)?[qpzr][qpzry9x8gf2tvdw0s3jn54khce6mua7l]{41}/gi,
};

// extractBchAddresses: finds and extracts valid BCH addresses/URIs from text
// Preserves BIP21 query params (?amount=, ?s=, etc.) when present
export function extractBchAddresses(text: string): string[] {
  const matches: Set<string> = new Set();

  // Find legacy address patterns
  const legacyMatches = text.match(bchAddressPatterns.legacy) || [];
  legacyMatches.forEach((match) => matches.add(match));

  // Find cashaddr patterns (normalize to lowercase)
  const cashaddrMatches = text.match(bchAddressPatterns.cashaddr) || [];
  cashaddrMatches.forEach((match) => matches.add(match.toLowerCase()));

  // Filter to only URIs with a valid address
  const validAddresses = Array.from(matches).filter((potential) => {
    const { isBip21 } = validateBip21Uri(potential);
    return isBip21;
  });

  return validAddresses;
}

// convertCashAddress: format any valid address to cashaddr or base58 format
export function convertCashAddress(
  address: string,
  format?: "cashaddr" | "tokenaddr" | "base58"
): string {
  const {
    address: prefixedAddress,
    isCashAddress,
    isBase58Address,
  } = validateBip21Uri(address);

  if (!isCashAddress && !isBase58Address) {
    throw new Error(`convertCashAddress: invalid address ${address}`);
  }

  if (!format) {
    return address;
  }

  // [?] assertSuccess since we already passed bip21 validation
  const decoded = assertSuccess(
    isBase58Address
      ? decodeBase58Address(prefixedAddress)
      : decodeCashAddress(prefixedAddress)
  );

  const type =
    format === "tokenaddr"
      ? CashAddressType.p2pkhWithTokens
      : CashAddressType.p2pkh;

  const encodeAddress =
    format === "base58"
      ? () => ({ address: encodeBase58Address("p2pkh", decoded.payload) }) // [!] we simply will not support non-p2pkh base58
      : () =>
          assertSuccess(
            encodeCashAddress({
              ...decoded,
              type,
            })
          );

  const { address: encoded } = encodeAddress();
  return encoded;
}

// addressToLockingBytecode: convert any address format to locking bytecode
export function addressToLockingBytecode(addr: string): Uint8Array {
  const { isBase58Address, address } = validateBip21Uri(addr);
  const lockingBytecode = isBase58Address
    ? base58AddressToLockingBytecode(address)
    : cashAddressToLockingBytecode(address);

  if (typeof lockingBytecode === "string") {
    throw new Error(lockingBytecode);
  }

  return lockingBytecode.bytecode;
}

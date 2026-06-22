import {
  binToUtf8,
  createVirtualMachineBCH,
  vmNumberToBigInt,
} from "@bitauth/libauth";
import type {
  NftCategory,
  NftCategoryField,
  NftType,
  ParsableNftCollection,
} from "@bitauth/libauth";

import { binToHex, hexToBin, hexToVmNumber } from "@/util/hex";

// -------------------------------- NFT capability

export type NftCapability = "minting" | "mutable" | "none" | null;

export function getNftCapabilityKey(
  capability: NftCapability
): "minting" | "mutable" | "none" {
  if (capability === "minting") return "minting";
  if (capability === "mutable") return "mutable";
  return "none";
}

// -------------------------------- NFT matching

/**
 * Normalize a commitment value (Uint8Array, hex string, or falsy) to hex.
 */
export function commitmentToHex(commitment: unknown): string {
  if (!commitment) return "";
  if (commitment instanceof Uint8Array) return binToHex(commitment);
  return String(commitment);
}

/**
 * Check whether an NFT input (UtxoEntity shape) matches an NFT output
 * (libauth Output shape) by category, capability, and commitment.
 */
export function nftOutputMatchesInput(
  input: {
    token_category: string;
    nft_capability: string;
    nft_commitment: string | null;
  },
  output: {
    token: {
      category: Uint8Array;
      nft: { capability: string; commitment?: unknown };
    };
  }
): boolean {
  return (
    binToHex(output.token.category) === input.token_category &&
    output.token.nft.capability === input.nft_capability &&
    commitmentToHex(output.token.nft.commitment) ===
      (input.nft_commitment || "")
  );
}

/**
 * Given token inputs and recipient outputs, return NFT inputs that have
 * no matching recipient NFT output (i.e., need change outputs).
 */
export function findUnmatchedNftInputs(tokenVin, vout) {
  const nftInputs = tokenVin.filter((input) => input.nft_capability !== null);
  const nftOutputs = vout.filter((output) => output.token?.nft);
  const claimed = new Set<number>();

  return nftInputs.filter((input) => {
    const matchIdx = nftOutputs.findIndex(
      (output, idx) => !claimed.has(idx) && nftOutputMatchesInput(input, output)
    );
    if (matchIdx >= 0) {
      claimed.add(matchIdx);
      return false;
    }
    return true;
  });
}

// -------------------------------- Types

export interface ParsedNftField {
  name: string;
  displayValue: string;
}

export interface ParsedNftResult {
  isSuccess: boolean;
  typeId?: string;
  nftType?: NftType;
  fields: ParsedNftField[];
}

const FAILED_RESULT: ParsedNftResult = { isSuccess: false, fields: [] };

// -------------------------------- Cache

const parseCache = new Map<string, ParsedNftResult>();

function cacheKey(category: string, commitment: string): string {
  return `${category}:${commitment}`;
}

export function clearParseCache(): void {
  parseCache.clear();
}

// -------------------------------- VM (lazy singleton)

let vmInstance: ReturnType<typeof createVirtualMachineBCH> | null = null;

function getVm() {
  if (!vmInstance) {
    vmInstance = createVirtualMachineBCH(false);
  }
  return vmInstance;
}

// -------------------------------- Public API

/**
 * Resolve the NFT type and field values for a given commitment.
 * Handles both sequential (direct lookup) and parsable (VM execution) NFTs.
 */
export function resolveNftType(
  tokenNfts: NftCategory | undefined,
  commitment: string | undefined,
  category: string
): ParsedNftResult {
  if (!tokenNfts || !commitment) return FAILED_RESULT;

  const key = cacheKey(category, commitment);
  const cached = parseCache.get(key);
  if (cached) return cached;

  const isParsable = "bytecode" in tokenNfts.parse;
  let result: ParsedNftResult;

  if (isParsable) {
    result = executeParsableNft(
      tokenNfts.parse as ParsableNftCollection,
      tokenNfts.fields,
      commitment,
      category
    );
  } else {
    const match = resolveSequentialType(tokenNfts.parse.types, commitment);
    result = {
      isSuccess: !!match,
      typeId: match?.typeId ?? commitment,
      nftType: match?.nftType,
      fields: [],
    };
  }

  parseCache.set(key, result);
  return result;
}

/**
 * Compare two hex strings numerically: try VM number (positive only),
 * then big-endian unsigned. Returns undefined if neither works.
 */
function compareNumericHex(a: string, b: string): number | undefined {
  // VM number (strictly positive, same byte-length only).
  // Non-minimal encodings like "0100" decode to the same VM number as "01",
  // producing false equality; requiring same length avoids this.
  // Strictly > 0 excludes the degenerate 0x80 case (VM=0, not minimal zero).
  const vmA = hexToVmNumber(a);
  const vmB = hexToVmNumber(b);
  if (
    vmA !== undefined &&
    vmB !== undefined &&
    vmA > 0n &&
    vmB > 0n &&
    a.length === b.length
  ) {
    if (vmA < vmB) return -1;
    if (vmA > vmB) return 1;
    return 0;
  }

  // Big-endian unsigned (naive encoding, e.g. BCH Gurus)
  if (a.length > 0 && b.length > 0) {
    const beA = BigInt(`0x${a}`);
    const beB = BigInt(`0x${b}`);
    if (beA < beB) return -1;
    if (beA > beB) return 1;
    return 0;
  }

  return undefined;
}

/**
 * Compare two NFT commitments for sorting.
 *
 * 1. BCMR-resolved typeId: sort numerically (VM number or big-endian)
 *    (works for sequential collections with prefix commitments like Badgers).
 *    For parsable NFTs, group by type key position in the registry.
 * 2. VM number of raw commitment (BCMR spec for sequential NFTs).
 * 3. Big-endian unsigned integer (common naive encoding, e.g. BCH Gurus).
 * 4. Hex string fallback.
 */
export function compareNftCommitments(
  tokenNfts: NftCategory | undefined,
  commitmentA: string,
  commitmentB: string,
  category: string
): number {
  if (commitmentA === commitmentB) return 0;

  // -------- BCMR-resolved type comparison
  if (tokenNfts) {
    const parsedA = resolveNftType(tokenNfts, commitmentA, category);
    const parsedB = resolveNftType(tokenNfts, commitmentB, category);

    if (parsedA.isSuccess && parsedB.isSuccess) {
      const isParsable = "bytecode" in tokenNfts.parse;

      if (isParsable) {
        // Parsable: group by type key position in the registry
        const typeKeys = Object.keys(tokenNfts.parse.types);
        const idxA = typeKeys.indexOf(parsedA.typeId || "");
        const idxB = typeKeys.indexOf(parsedB.typeId || "");
        if (idxA !== idxB) return idxA - idxB;
      } else {
        // Sequential: sort by resolved typeId numerically
        const idA = parsedA.typeId || "";
        const idB = parsedB.typeId || "";
        const cmp = compareNumericHex(idA, idB);
        if (cmp !== undefined) return cmp;
      }
    }
  }

  // -------- Numeric comparison on raw commitment
  const cmp = compareNumericHex(commitmentA, commitmentB);
  if (cmp !== undefined) return cmp;

  // -------- Hex string fallback
  return commitmentA.localeCompare(commitmentB);
}

// -------------------------------- Sequential lookup

interface SequentialMatch {
  nftType: NftType;
  typeId: string;
}

/**
 * Look up an NFT type in a sequential collection.
 * Per BCMR spec, commitments are "interpreted as a VM number."
 *
 * 1. Exact hex match (fast path)
 * 2. VM number comparison on full commitment (padded encodings)
 * 3. Prefix extraction + VM number comparison at each registry key
 *    byte-length (handles [type_key][stats] commitments in registries
 *    that should have used parse.bytecode)
 */
function resolveSequentialType(
  types: Record<string, NftType>,
  commitment: string
): SequentialMatch | undefined {
  // 1. Exact hex match (fast path, covers well-formed registries)
  if (types[commitment]) {
    return { nftType: types[commitment], typeId: commitment };
  }

  // Build VM number → type lookup for numeric comparison
  const vmLookup = buildVmLookup(types);

  // 2. Full commitment as VM number (padded encoding of same value)
  const commitmentNum = hexToVmNumber(commitment);
  if (commitmentNum !== undefined) {
    const match = vmLookup.get(commitmentNum);
    if (match) return match;
  }

  // 3. Prefix match at each key byte-length (longest first).
  // For commitments structured as [type_key][stats/attributes], extracts
  // N bytes from the start and compares as a VM number against type keys.
  // Handles registries that should have used parse.bytecode.
  const keyByteLengths = collectKeyByteLengths(types);
  const commitmentHexLen = commitment.length;

  let prefixMatch: SequentialMatch | undefined;
  keyByteLengths.some((byteLen) => {
    const hexLen = byteLen * 2;
    if (hexLen > 0 && hexLen < commitmentHexLen) {
      const prefixNum = hexToVmNumber(commitment.substring(0, hexLen));
      if (prefixNum !== undefined) {
        prefixMatch = vmLookup.get(prefixNum);
        return !!prefixMatch;
      }
    }
    return false;
  });
  if (prefixMatch) return prefixMatch;

  return undefined;
}

// -------- Sequential helpers

/** Map each type key's VM number value to its NftType + original key. */
function buildVmLookup(
  types: Record<string, NftType>
): Map<bigint, SequentialMatch> {
  const map = new Map<bigint, SequentialMatch>();
  Object.keys(types).forEach((key) => {
    const num = hexToVmNumber(key);
    if (num !== undefined && !map.has(num)) {
      map.set(num, { nftType: types[key], typeId: key });
    }
  });
  return map;
}

/** Unique key byte-lengths from a types record, sorted longest first. */
function collectKeyByteLengths(types: Record<string, unknown>): number[] {
  const seen = new Set<number>();
  Object.keys(types).forEach((k) => seen.add(k.length / 2));
  return Array.from(seen).sort((a, b) => b - a);
}

// -------------------------------- VM execution

function executeParsableNft(
  parse: ParsableNftCollection,
  categoryFields: NftCategoryField | undefined,
  commitment: string,
  category: string
): ParsedNftResult {
  const vm = getVm();
  const parseBytecode = hexToBin(parse.bytecode);
  const commitmentBin = hexToBin(commitment);
  const categoryBin = hexToBin(category);

  // Build synthetic NFT parsing transaction per BCMR spec:
  // - Input 0: UTXO with NFT, empty unlocking bytecode
  // - Input 1: parse bytecode as locking, OP_1 as unlocking
  // - Output 0: OP_RETURN, value 0
  const sourceOutputs = [
    {
      lockingBytecode: Uint8Array.of(0x6a), // OP_RETURN
      valueSatoshis: 0n,
      token: {
        amount: 0n,
        category: categoryBin,
        nft: {
          capability: "none" as const,
          commitment: commitmentBin,
        },
      },
    },
    {
      lockingBytecode: parseBytecode,
      valueSatoshis: 0n,
    },
  ];

  const transaction = {
    version: 2,
    inputs: [
      {
        outpointTransactionHash: new Uint8Array(32),
        outpointIndex: 0,
        unlockingBytecode: new Uint8Array(0),
        sequenceNumber: 0,
      },
      {
        outpointTransactionHash: new Uint8Array(32),
        outpointIndex: 0,
        unlockingBytecode: Uint8Array.of(0x51), // OP_1
        sequenceNumber: 0,
      },
    ],
    outputs: [
      {
        lockingBytecode: Uint8Array.of(0x6a), // OP_RETURN
        valueSatoshis: 0n,
      },
    ],
    locktime: 0,
  };

  const program = { sourceOutputs, transaction, inputIndex: 1 };

  let state;
  try {
    state = vm.evaluate(program);
  } catch {
    return FAILED_RESULT;
  }

  // Tolerate main-stack errors (bytecode may leave extra items).
  // Fail only if altstack is empty.
  const altstack = state.alternateStack;
  if (!altstack || altstack.length === 0) return FAILED_RESULT;

  // Bottom of altstack = type ID
  const typeId = binToHex(altstack[0]);
  const nftType = parse.types[typeId];
  if (!nftType) {
    return { isSuccess: false, typeId, fields: [] };
  }

  // Remaining altstack items = field values
  const fields = decodeFields(
    altstack.slice(1),
    nftType.fields,
    categoryFields
  );

  return { isSuccess: true, typeId, nftType, fields };
}

// -------------------------------- Field decoding

function decodeFields(
  altstackItems: Uint8Array[],
  fieldIdentifiers: string[] | undefined,
  categoryFields: NftCategoryField | undefined
): ParsedNftField[] {
  if (!fieldIdentifiers || !categoryFields) return [];

  const result: ParsedNftField[] = [];
  fieldIdentifiers.forEach((id, i) => {
    if (i >= altstackItems.length) return;
    const fieldDef = categoryFields[id];
    if (!fieldDef) return;
    const name = fieldDef.name || id;
    const displayValue = decodeFieldValue(altstackItems[i], fieldDef.encoding);
    result.push({ name, displayValue });
  });
  return result;
}

export function decodeFieldValue(
  bytes: Uint8Array,
  encoding: NftCategoryField[string]["encoding"]
): string {
  switch (encoding.type) {
    case "number":
      return decodeNumber(bytes, encoding.decimals, encoding.unit);
    case "utf8":
      return binToUtf8(bytes);
    case "boolean":
      if (bytes.length === 1 && bytes[0] === 0x01) return "true";
      if (bytes.length === 0 || (bytes.length === 1 && bytes[0] === 0x00))
        return "false";
      return binToHex(bytes);
    case "hex":
      return `0x${binToHex(bytes)}`;
    case "binary":
      return `0b${Array.from(bytes)
        .map((b) => b.toString(2).padStart(8, "0"))
        .join("")}`;
    case "https-url":
      return `https://${binToUtf8(bytes)}`;
    case "ipfs-cid":
      return `ipfs://${binToUtf8(bytes)}`;
    case "locktime":
      return decodeLocktime(bytes);
    default:
      return binToHex(bytes);
  }
}

// -------------------------------- Helpers

function decodeNumber(
  bytes: Uint8Array,
  decimals?: number,
  unit?: string
): string {
  // Try standard VM number decode first
  let value = vmNumberToBigInt(bytes);

  // Padded fallback: if minimal encoding fails, try without that requirement
  if (typeof value === "string") {
    value = vmNumberToBigInt(bytes, {
      maximumVmNumberByteLength: bytes.length,
      requireMinimalEncoding: false,
    });
  }

  if (typeof value === "string") {
    return `0x${binToHex(bytes)}`;
  }

  const dec = decimals || 0;
  let formatted: string;

  if (dec > 0) {
    const isNegative = value < 0n;
    const abs = isNegative ? -value : value;
    const str = abs.toString().padStart(dec + 1, "0");
    const intPart = str.slice(0, str.length - dec);
    const fracPart = str.slice(str.length - dec);
    formatted = `${isNegative ? "-" : ""}${intPart}.${fracPart}`;
  } else {
    formatted = value.toString();
  }

  return unit ? `${formatted} ${unit}` : formatted;
}

function decodeLocktime(bytes: Uint8Array): string {
  const value = vmNumberToBigInt(bytes, {
    maximumVmNumberByteLength: 5,
    requireMinimalEncoding: false,
  });

  if (typeof value === "string") return `0x${binToHex(bytes)}`;

  const num = Number(value);
  if (num < 500000000) {
    return `Block ${num}`;
  }
  return new Date(num * 1000).toISOString();
}

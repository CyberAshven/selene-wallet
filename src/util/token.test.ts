import { describe, it, expect, beforeEach } from "vitest";

import { hexToBin } from "@bitauth/libauth";

import {
  resolveNftType,
  decodeFieldValue,
  clearParseCache,
  commitmentToHex,
  nftOutputMatchesInput,
  findUnmatchedNftInputs,
} from "./token";

// -------------------------------- Helpers

function makeSequentialNfts(types: Record<string, { name: string }>) {
  return {
    parse: { types },
  };
}

function makeParsableNfts(
  bytecode: string,
  types: Record<string, { name: string; fields?: string[] }>,
  fields?: Record<
    string,
    {
      name: string;
      encoding: { type: string; decimals?: number; unit?: string };
    }
  >
) {
  return {
    parse: { bytecode, types },
    fields,
  };
}

// -------------------------------- Tests

describe("resolveNftType", () => {
  beforeEach(() => {
    clearParseCache();
  });

  it("returns failed for undefined nfts", () => {
    const result = resolveNftType(undefined, "00", "abc123");
    expect(result.isSuccess).toBe(false);
  });

  it("returns failed for undefined commitment", () => {
    const nfts = makeSequentialNfts({ "00": { name: "Test" } });
    const result = resolveNftType(nfts as any, undefined, "abc123");
    expect(result.isSuccess).toBe(false);
  });

  // -------- Sequential NFTs

  it("resolves sequential NFT by direct lookup", () => {
    const nfts = makeSequentialNfts({
      "01": { name: "Badge #1" },
      "02": { name: "Badge #2" },
    });
    const result = resolveNftType(nfts as any, "01", "cat1");
    expect(result.isSuccess).toBe(true);
    expect(result.typeId).toBe("01");
    expect(result.nftType?.name).toBe("Badge #1");
    expect(result.fields).toEqual([]);
  });

  it("returns failed for unmatched sequential commitment", () => {
    const nfts = makeSequentialNfts({ "01": { name: "Badge #1" } });
    const result = resolveNftType(nfts as any, "ff", "cat1");
    expect(result.isSuccess).toBe(false);
  });

  it("resolves by VM number comparison (padded encoding)", () => {
    const nfts = makeSequentialNfts({
      "05": { name: "Badge #5" },
      "9000": { name: "Badge #144" },
    });

    // "0500" is a padded encoding of VM number 5 (same as "05")
    const result1 = resolveNftType(nfts as any, "0500", "cat1");
    expect(result1.isSuccess).toBe(true);
    expect(result1.typeId).toBe("05");
    expect(result1.nftType?.name).toBe("Badge #5");

    // "900000" is a padded encoding of VM number 144 (same as "9000")
    const result2 = resolveNftType(nfts as any, "900000", "cat1");
    expect(result2.isSuccess).toBe(true);
    expect(result2.typeId).toBe("9000");
    expect(result2.nftType?.name).toBe("Badge #144");
  });

  it("prefix resolves zero-prefixed commitment via VM number", () => {
    const nfts = makeSequentialNfts({
      "": { name: "Honey" },
      "9000": { name: "Badger #144" },
    });
    // "0000" prefix = VM number 0 = matches "" (Honey).
    // The remaining bytes are Honey value/attributes, not a badge ID.
    const result = resolveNftType(nfts as any, "00009000", "cat1");
    expect(result.isSuccess).toBe(true);
    expect(result.typeId).toBe("");
    expect(result.nftType?.name).toBe("Honey");
  });

  // -------- Prefix match (type ID + stats data)

  it("resolves by prefix VM number (type ID + stats data)", () => {
    const nfts = makeSequentialNfts({
      "4f": { name: "Badger #79" },
      "9100": { name: "Badger #145" },
    });

    // 1-byte type ID followed by stats: "4f" prefix = VM number 79
    const result1 = resolveNftType(nfts as any, "4f00020a0601", "cat1");
    expect(result1.isSuccess).toBe(true);
    expect(result1.typeId).toBe("4f");
    expect(result1.nftType?.name).toBe("Badger #79");

    // 2-byte type ID followed by stats: "9100" prefix = VM number 145
    const result2 = resolveNftType(nfts as any, "910000020a0601090a", "cat1");
    expect(result2.isSuccess).toBe(true);
    expect(result2.typeId).toBe("9100");
    expect(result2.nftType?.name).toBe("Badger #145");
  });

  it("prefix VM number unifies across byte widths", () => {
    const nfts = makeSequentialNfts({
      "4f": { name: "Badger #79" },
    });
    // 2-byte prefix "4f00" = padded VM number 79, matches 1-byte key "4f"
    const result = resolveNftType(nfts as any, "4f00aabb", "cat1");
    expect(result.isSuccess).toBe(true);
    expect(result.typeId).toBe("4f");
    expect(result.nftType?.name).toBe("Badger #79");
  });

  // -------- Parsable NFTs

  it("executes parse bytecode and resolves type + fields", () => {
    // OP_0 OP_UTXOTOKENCOMMITMENT(0xcf) OP_1 OP_SPLIT OP_SWAP OP_TOALTSTACK OP_TOALTSTACK
    // Splits commitment after 1 byte: first byte → altstack[0] (type ID),
    // remaining bytes → altstack[1] (field value)
    const bytecode = "00cf517f7c6b6b";
    const nfts = makeParsableNfts(
      bytecode,
      {
        "01": {
          name: "Staking Receipt",
          fields: ["amount"],
        },
      },
      {
        amount: {
          name: "Amount Staked",
          encoding: { type: "number", decimals: 2, unit: "PUSD" },
        },
      }
    );

    // Commitment: 01 (type=01) + e803 (VM number 1000)
    const commitment = "01e803";
    const result = resolveNftType(
      nfts as any,
      commitment,
      "aabbccdd".repeat(8)
    );
    expect(result.isSuccess).toBe(true);
    expect(result.typeId).toBe("01");
    expect(result.nftType?.name).toBe("Staking Receipt");
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].name).toBe("Amount Staked");
    expect(result.fields[0].displayValue).toBe("10.00 PUSD");
  });

  it("returns failed when parse bytecode produces empty altstack", () => {
    // OP_0 OP_UTXOTOKENCOMMITMENT(0xcf) OP_DROP — puts nothing on altstack
    const bytecode = "00cf75";
    const nfts = makeParsableNfts(bytecode, { "01": { name: "Test" } });
    const commitment = "01ff";
    const result = resolveNftType(nfts as any, commitment, "aa".repeat(32));
    expect(result.isSuccess).toBe(false);
  });

  it("returns failed when type ID does not match any type", () => {
    const bytecode = "00cf517f7c6b6b";
    const nfts = makeParsableNfts(bytecode, {
      "02": { name: "Only Type Two" },
    });
    // Commitment starts with 01, but only type 02 exists
    const commitment = "01ff";
    const result = resolveNftType(nfts as any, commitment, "bb".repeat(32));
    expect(result.isSuccess).toBe(false);
    expect(result.typeId).toBe("01");
  });

  // -------- Cache

  it("returns cached result on second call", () => {
    const nfts = makeSequentialNfts({ "01": { name: "Cached" } });
    const first = resolveNftType(nfts as any, "01", "cat1");
    const second = resolveNftType(nfts as any, "01", "cat1");
    expect(first).toBe(second); // same reference
  });
});

// -------------------------------- Field decoding

describe("decodeFieldValue", () => {
  it("decodes number with decimals and unit", () => {
    // VM number 1000 = e803
    const bytes = Uint8Array.of(0xe8, 0x03);
    const result = decodeFieldValue(bytes, {
      type: "number",
      decimals: 2,
      unit: "BCH",
    });
    expect(result).toBe("10.00 BCH");
  });

  it("decodes number without decimals", () => {
    const bytes = Uint8Array.of(0x05);
    const result = decodeFieldValue(bytes, { type: "number" });
    expect(result).toBe("5");
  });

  it("decodes negative number", () => {
    // VM number -1 = 0x81
    const bytes = Uint8Array.of(0x81);
    const result = decodeFieldValue(bytes, { type: "number" });
    expect(result).toBe("-1");
  });

  it("decodes number zero from empty bytes", () => {
    const bytes = new Uint8Array(0);
    const result = decodeFieldValue(bytes, { type: "number" });
    expect(result).toBe("0");
  });

  it("decodes padded number (non-minimal encoding)", () => {
    // 0x0500 — padded representation of 5
    const bytes = Uint8Array.of(0x05, 0x00);
    const result = decodeFieldValue(bytes, { type: "number" });
    expect(result).toBe("5");
  });

  it("decodes utf8", () => {
    const bytes = new TextEncoder().encode("Hello, BCH!");
    const result = decodeFieldValue(bytes, { type: "utf8" });
    expect(result).toBe("Hello, BCH!");
  });

  it("decodes boolean true", () => {
    const result = decodeFieldValue(Uint8Array.of(0x01), { type: "boolean" });
    expect(result).toBe("true");
  });

  it("decodes boolean false (0x00)", () => {
    const result = decodeFieldValue(Uint8Array.of(0x00), { type: "boolean" });
    expect(result).toBe("false");
  });

  it("decodes boolean false (empty)", () => {
    const result = decodeFieldValue(new Uint8Array(0), { type: "boolean" });
    expect(result).toBe("false");
  });

  it("falls back to hex for invalid boolean", () => {
    const result = decodeFieldValue(Uint8Array.of(0x02), { type: "boolean" });
    expect(result).toBe("02");
  });

  it("decodes hex", () => {
    const result = decodeFieldValue(Uint8Array.of(0xab, 0xcd), { type: "hex" });
    expect(result).toBe("0xabcd");
  });

  it("decodes binary", () => {
    const result = decodeFieldValue(Uint8Array.of(0x05), { type: "binary" });
    expect(result).toBe("0b00000101");
  });

  it("decodes https-url", () => {
    const bytes = new TextEncoder().encode("example.com/nft/1");
    const result = decodeFieldValue(bytes, { type: "https-url" });
    expect(result).toBe("https://example.com/nft/1");
  });

  it("decodes ipfs-cid", () => {
    const bytes = new TextEncoder().encode("QmTest123");
    const result = decodeFieldValue(bytes, { type: "ipfs-cid" });
    expect(result).toBe("ipfs://QmTest123");
  });

  it("decodes locktime as block height", () => {
    // 800000 = 0x0C3500, VM number LE = 00 35 0c
    const bytes = Uint8Array.of(0x00, 0x35, 0x0c);
    const result = decodeFieldValue(bytes, { type: "locktime" });
    expect(result).toBe("Block 800000");
  });

  it("decodes locktime as timestamp", () => {
    // 1700000000 = 0x6553F100, VM number LE = 00 f1 53 65
    const bytes = Uint8Array.of(0x00, 0xf1, 0x53, 0x65);
    const result = decodeFieldValue(bytes, { type: "locktime" });
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});

// -------------------------------- commitmentToHex

describe("commitmentToHex", () => {
  it("returns empty string for falsy values", () => {
    expect(commitmentToHex(null)).toBe("");
    expect(commitmentToHex(undefined)).toBe("");
    expect(commitmentToHex("")).toBe("");
  });

  it("converts Uint8Array to hex", () => {
    expect(commitmentToHex(Uint8Array.of(0xde, 0xad))).toBe("dead");
  });

  it("passes through hex strings", () => {
    expect(commitmentToHex("cafe")).toBe("cafe");
  });
});

// -------------------------------- nftOutputMatchesInput

const CAT_HEX = "aabbccdd";
const CAT_BIN = hexToBin(CAT_HEX);

function makeNftInput(
  category: string,
  capability: string,
  commitment: string | null = null
) {
  return {
    token_category: category,
    nft_capability: capability,
    nft_commitment: commitment,
  };
}

function makeNftOutput(
  category: Uint8Array,
  capability: string,
  commitment?: Uint8Array | string
) {
  return {
    token: {
      category,
      nft: { capability, commitment },
    },
  };
}

describe("nftOutputMatchesInput", () => {
  it("matches identical NFT (no commitment)", () => {
    const input = makeNftInput(CAT_HEX, "none");
    const output = makeNftOutput(CAT_BIN, "none");
    expect(nftOutputMatchesInput(input, output)).toBe(true);
  });

  it("matches with hex string commitment", () => {
    const input = makeNftInput(CAT_HEX, "none", "dead");
    const output = makeNftOutput(CAT_BIN, "none", "dead");
    expect(nftOutputMatchesInput(input, output)).toBe(true);
  });

  it("matches with Uint8Array commitment on output", () => {
    const input = makeNftInput(CAT_HEX, "none", "dead");
    const output = makeNftOutput(CAT_BIN, "none", Uint8Array.of(0xde, 0xad));
    expect(nftOutputMatchesInput(input, output)).toBe(true);
  });

  it("rejects different category", () => {
    const input = makeNftInput("11223344", "none");
    const output = makeNftOutput(CAT_BIN, "none");
    expect(nftOutputMatchesInput(input, output)).toBe(false);
  });

  it("rejects different capability", () => {
    const input = makeNftInput(CAT_HEX, "mutable");
    const output = makeNftOutput(CAT_BIN, "none");
    expect(nftOutputMatchesInput(input, output)).toBe(false);
  });

  it("rejects different commitment", () => {
    const input = makeNftInput(CAT_HEX, "none", "dead");
    const output = makeNftOutput(CAT_BIN, "none", "beef");
    expect(nftOutputMatchesInput(input, output)).toBe(false);
  });
});

// -------------------------------- findUnmatchedNftInputs

describe("findUnmatchedNftInputs", () => {
  it("returns empty when all NFT inputs have matching outputs", () => {
    const inputs = [
      {
        token_category: CAT_HEX,
        nft_capability: "none",
        nft_commitment: "01",
        token_amount: 0n,
      },
    ];
    const outputs = [makeNftOutput(CAT_BIN, "none", "01")];
    expect(findUnmatchedNftInputs(inputs, outputs)).toEqual([]);
  });

  it("returns NFT inputs with no matching output", () => {
    const inputs = [
      {
        token_category: CAT_HEX,
        nft_capability: "none",
        nft_commitment: "01",
        token_amount: 0n,
      },
    ];
    const outputs = []; // no NFT outputs
    const result = findUnmatchedNftInputs(inputs, outputs);
    expect(result).toHaveLength(1);
    expect(result[0].nft_commitment).toBe("01");
  });

  it("skips pure-FT inputs (nft_capability === null)", () => {
    const inputs = [
      {
        token_category: CAT_HEX,
        nft_capability: null,
        nft_commitment: null,
        token_amount: 500n,
      },
    ];
    const outputs = [];
    expect(findUnmatchedNftInputs(inputs, outputs)).toEqual([]);
  });

  it("matches one-to-one (no double-claiming)", () => {
    const inputs = [
      {
        token_category: CAT_HEX,
        nft_capability: "none",
        nft_commitment: "01",
        token_amount: 0n,
      },
      {
        token_category: CAT_HEX,
        nft_capability: "none",
        nft_commitment: "01",
        token_amount: 0n,
      },
    ];
    // Only one output for two identical inputs
    const outputs = [makeNftOutput(CAT_BIN, "none", "01")];
    const result = findUnmatchedNftInputs(inputs, outputs);
    expect(result).toHaveLength(1);
  });

  it("scenario A: hybrid UTXO NFT sent, FT should be unmatched input concern", () => {
    // Hybrid UTXO: NFT + 346 FT. User sends the NFT (matched output exists).
    // The NFT is accounted for, so findUnmatchedNftInputs returns empty.
    const inputs = [
      {
        token_category: CAT_HEX,
        nft_capability: "none",
        nft_commitment: "ab",
        token_amount: 346n,
      },
    ];
    const outputs = [makeNftOutput(CAT_BIN, "none", "ab")];
    expect(findUnmatchedNftInputs(inputs, outputs)).toEqual([]);
  });

  it("scenario B: hybrid UTXO used for FT, NFT is unmatched", () => {
    // Hybrid UTXO: NFT + 500 FT. User sends 100 FT (no NFT output).
    // The NFT has no matching output, so it should be returned as unmatched.
    const inputs = [
      {
        token_category: CAT_HEX,
        nft_capability: "mutable",
        nft_commitment: "ff",
        token_amount: 500n,
      },
    ];
    // Only FT outputs, no NFT outputs
    const outputs = [{ token: { category: CAT_BIN, amount: 100n } }];
    const result = findUnmatchedNftInputs(inputs, outputs);
    expect(result).toHaveLength(1);
    expect(result[0].nft_capability).toBe("mutable");
  });
});

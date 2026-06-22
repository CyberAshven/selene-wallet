/**
 * Unit tests for cashaddr.ts - BCH address utilities
 *
 * These tests are CRITICAL because:
 * - Invalid address handling could send funds to wrong addresses
 * - Address format conversion must be lossless
 * - Extracting addresses from text (QR codes, messages) must be accurate
 */

import { describe, it, expect } from "vitest";
import {
  extractBchAddresses,
  convertCashAddress,
  addressToLockingBytecode,
} from "./cashaddr";

// Test addresses - these are REAL valid addresses (checksums verified)
// Using well-known BCH addresses for testing
const VALID_LEGACY = "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2";
// Derive valid cashaddr from legacy to ensure checksum is valid
const VALID_CASHADDR = "bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a"; // satoshi's genesis address
const VALID_CASHADDR_NO_PREFIX = "qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a";

describe("cashaddr.ts", () => {
  describe("extractBchAddresses", () => {
    it("extracts a single cashaddr from text", () => {
      const text = `Please send to ${VALID_CASHADDR}`;
      const addresses = extractBchAddresses(text);
      expect(addresses).toContain(VALID_CASHADDR);
    });

    it("extracts cashaddr without prefix", () => {
      const text = `Send to ${VALID_CASHADDR_NO_PREFIX}`;
      const addresses = extractBchAddresses(text);
      // Should find it and normalize with prefix
      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses[0]).toContain(VALID_CASHADDR_NO_PREFIX);
    });

    it("extracts legacy addresses", () => {
      const text = `Old address: ${VALID_LEGACY}`;
      const addresses = extractBchAddresses(text);
      expect(addresses).toContain(VALID_LEGACY);
    });

    it("extracts multiple addresses from text", () => {
      const text = `
        Send BCH to ${VALID_CASHADDR}
        Or legacy: ${VALID_LEGACY}
      `;
      const addresses = extractBchAddresses(text);
      expect(addresses.length).toBe(2);
    });

    it("returns empty array for text with no addresses", () => {
      const text = "Hello world, no addresses here!";
      const addresses = extractBchAddresses(text);
      expect(addresses).toEqual([]);
    });

    it("deduplicates repeated addresses", () => {
      const text = `${VALID_CASHADDR} and again ${VALID_CASHADDR}`;
      const addresses = extractBchAddresses(text);
      expect(addresses.length).toBe(1);
    });

    it("ignores invalid addresses that look similar", () => {
      // This looks like an address but has invalid characters
      const text = "qz2g9hxwpuw5qxrd2nxpk47dwe48xqfxwcp6qmflu0"; // ends in 0 which is invalid in bech32
      const addresses = extractBchAddresses(text);
      expect(addresses.length).toBe(0);
    });

    it("handles messy input with special characters", () => {
      const text = `!!!${VALID_CASHADDR}!!!`;
      const addresses = extractBchAddresses(text);
      expect(addresses.length).toBe(1);
    });
  });

  describe("convertCashAddress", () => {
    it("returns address unchanged when no format specified", () => {
      const result = convertCashAddress(VALID_CASHADDR);
      expect(result).toBe(VALID_CASHADDR);
    });

    it("converts cashaddr to cashaddr (identity)", () => {
      const result = convertCashAddress(VALID_CASHADDR, "cashaddr");
      expect(result).toBe(VALID_CASHADDR);
    });

    it("converts cashaddr to tokenaddr", () => {
      const result = convertCashAddress(VALID_CASHADDR, "tokenaddr");
      // Token addresses start with 'z' instead of 'q'
      expect(result).toMatch(/^bitcoincash:z/);
    });

    it("converts legacy to cashaddr", () => {
      const result = convertCashAddress(VALID_LEGACY, "cashaddr");
      expect(result).toMatch(/^bitcoincash:q/);
    });

    it("converts cashaddr to base58", () => {
      const result = convertCashAddress(VALID_CASHADDR, "base58");
      // Base58 addresses start with 1 or 3
      expect(result).toMatch(/^[13]/);
    });

    it("throws on invalid address", () => {
      expect(() => convertCashAddress("not-an-address", "cashaddr")).toThrow();
    });

    it("round-trips cashaddr -> base58 -> cashaddr", () => {
      const base58 = convertCashAddress(VALID_CASHADDR, "base58");
      const backToCashaddr = convertCashAddress(base58, "cashaddr");
      expect(backToCashaddr).toBe(VALID_CASHADDR);
    });
  });

  describe("addressToLockingBytecode", () => {
    it("converts cashaddr to locking bytecode", () => {
      const bytecode = addressToLockingBytecode(VALID_CASHADDR);
      expect(bytecode).toBeInstanceOf(Uint8Array);
      // P2PKH locking bytecode is 25 bytes
      expect(bytecode.length).toBe(25);
    });

    it("converts legacy address to locking bytecode", () => {
      const bytecode = addressToLockingBytecode(VALID_LEGACY);
      expect(bytecode).toBeInstanceOf(Uint8Array);
      expect(bytecode.length).toBe(25);
    });

    it("produces same bytecode for equivalent addresses", () => {
      // Convert legacy to cashaddr, both should produce same bytecode
      const cashaddr = convertCashAddress(VALID_LEGACY, "cashaddr");
      const bytecodeLegacy = addressToLockingBytecode(VALID_LEGACY);
      const bytecodeCashaddr = addressToLockingBytecode(cashaddr);
      expect(bytecodeLegacy).toEqual(bytecodeCashaddr);
    });

    it("throws on invalid address", () => {
      expect(() => addressToLockingBytecode("invalid")).toThrow();
    });
  });
});

/**
 * Unit tests for sats.ts - satoshi/BCH conversion utilities
 *
 * These tests are CRITICAL because incorrect conversions = lost money.
 * We test:
 * - Normal cases (happy path)
 * - Edge cases (zero, maximum values)
 * - Precision handling (8 decimal places)
 * - Different input types (number, string, bigint)
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  satsToBch,
  bchToSats,
  SATOSHI,
  MAX_SATOSHI,
  VALID_DENOMINATIONS,
} from "./sats";

describe("sats.ts", () => {
  describe("satsToBch", () => {
    it("converts 1 BCH worth of sats correctly", () => {
      const result = satsToBch(100000000n);
      expect(result.sats).toBe(100000000n);
      expect(result.bch).toBe("1.00000000");
    });

    it("converts 0 sats correctly", () => {
      const result = satsToBch(0n);
      expect(result.sats).toBe(0n);
      expect(result.bch).toBe("0.00000000");
    });

    it("converts 1 sat correctly", () => {
      const result = satsToBch(1n);
      expect(result.sats).toBe(1n);
      expect(result.bch).toBe("0.00000001");
    });

    it("converts fractional BCH amounts correctly", () => {
      const result = satsToBch(12345678n);
      expect(result.sats).toBe(12345678n);
      expect(result.bch).toBe("0.12345678");
    });

    it("handles large amounts (21 million BCH)", () => {
      const result = satsToBch(MAX_SATOSHI);
      expect(result.sats).toBe(MAX_SATOSHI);
      expect(result.bch).toBe("21000000.00000000");
    });

    it("accepts number input", () => {
      const result = satsToBch(50000000);
      expect(result.sats).toBe(50000000n);
      expect(result.bch).toBe("0.50000000");
    });

    it("accepts string input", () => {
      const result = satsToBch("25000000");
      expect(result.sats).toBe(25000000n);
      expect(result.bch).toBe("0.25000000");
    });

    it("rounds down (not up) for display", () => {
      // This is important for financial applications - we never want to show
      // users more than they actually have
      const result = satsToBch(100000001n);
      // Should be 1.00000001, demonstrating 8 decimal precision
      expect(result.bch).toBe("1.00000001");
    });
  });

  describe("bchToSats", () => {
    it("converts 1 BCH to sats correctly", () => {
      const result = bchToSats(1);
      expect(result).toBe(100000000n);
    });

    it("converts 0 BCH correctly", () => {
      const result = bchToSats(0);
      expect(result).toBe(0n);
    });

    it("converts fractional BCH correctly", () => {
      const result = bchToSats(0.12345678);
      expect(result).toBe(12345678n);
    });

    it("converts string input correctly", () => {
      const result = bchToSats("0.5");
      expect(result).toBe(50000000n);
    });

    it("handles 21 million BCH", () => {
      const result = bchToSats(21000000);
      expect(result).toBe(MAX_SATOSHI);
    });

    it("rounds down extra decimal places (not up)", () => {
      // BCH only has 8 decimal places, so extra precision should be truncated
      const result = bchToSats(0.123456789);
      expect(result).toBe(12345678n); // 9 is dropped, not rounded
    });

    it("handles sats denomination (passthrough)", () => {
      const result = bchToSats(12345, "sats");
      expect(result).toBe(12345n);
    });

    it("handles string with sats denomination", () => {
      const result = bchToSats("99999", "sats");
      expect(result).toBe(99999n);
    });

    it("throws on null input", () => {
      expect(() => bchToSats(null)).toThrow("input is required");
    });

    it("throws on undefined input", () => {
      expect(() => bchToSats(undefined)).toThrow("input is required");
    });

    it("throws on empty string input", () => {
      expect(() => bchToSats("")).toThrow("input is required");
    });

    it("throws on non-numeric string input", () => {
      expect(() => bchToSats("abc")).toThrow();
    });
  });

  describe("constants", () => {
    it("SATOSHI is 100 million", () => {
      expect(SATOSHI).toBe(100000000n);
    });

    it("MAX_SATOSHI is 21 million * 100 million", () => {
      expect(MAX_SATOSHI).toBe(2100000000000000n);
    });

    it("VALID_DENOMINATIONS includes BCH and sats", () => {
      expect(VALID_DENOMINATIONS).toContain("BCH");
      expect(VALID_DENOMINATIONS).toContain("sats");
    });
  });

  describe("round-trip conversions", () => {
    // These tests ensure converting BCH -> sats -> BCH gives the same result
    it("round-trips 1 BCH correctly", () => {
      const sats = bchToSats(1);
      const bch = satsToBch(sats);
      expect(bch.bch).toBe("1.00000000");
    });

    it("round-trips fractional BCH correctly", () => {
      const original = "0.12345678";
      const sats = bchToSats(original);
      const bch = satsToBch(sats);
      expect(bch.bch).toBe(original);
    });

    it("round-trips common amounts correctly", () => {
      const amounts = ["0.00001000", "0.00100000", "0.10000000", "10.00000000"];
      amounts.forEach((amount) => {
        const sats = bchToSats(amount);
        const bch = satsToBch(sats);
        expect(bch.bch).toBe(amount);
      });
    });
  });

  // ── Property-based tests ────────────────────────────────────────────

  describe("property: sats roundtrip", () => {
    it("sats -> bch -> sats is lossless for all valid amounts", () => {
      fc.assert(
        fc.property(fc.bigInt({ min: 0n, max: MAX_SATOSHI }), (sats) => {
          const { bch } = satsToBch(sats);
          const back = bchToSats(bch);
          expect(back).toBe(sats);
        }),
        { numRuns: 500 }
      );
    });

    it("send-max: bchToSats(satsToBch(totalBalance)) === totalBalance", () => {
      fc.assert(
        fc.property(fc.bigInt({ min: 0n, max: MAX_SATOSHI }), (balance) => {
          const displayed = satsToBch(balance).bch;
          const sentBack = bchToSats(displayed);
          expect(sentBack).toBe(balance);
        }),
        { numRuns: 300 }
      );
    });

    it("truncation never rounds up", () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 0n, max: MAX_SATOSHI }),
          fc.integer({ min: 1, max: 99 }),
          (sats, extra) => {
            // Add sub-satoshi fraction via string: "X.YYYYYYYY9Z"
            const bchStr = satsToBch(sats).bch;
            const withExtra = `${bchStr}${extra}`;
            const result = bchToSats(withExtra);
            expect(result).toBe(sats);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});

/**
 * Unit tests for uri.ts - BCH URI parsing and validation
 *
 * These tests are CRITICAL because:
 * - Incorrect URI parsing could cause payments to wrong addresses
 * - Amount parsing errors could result in wrong payment amounts
 * - WIF validation is used for wallet sweeping (importing funds)
 * - WalletConnect URI parsing enables dApp connections
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  isIntStr,
  validateBip21Uri,
  validateWifUri,
  validateWalletConnectUri,
  validateBchUri,
  toAlphanumericUri,
  fromAlphanumericUri,
} from "./uri";

// Valid test addresses
const VALID_CASHADDR = "bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a";
const VALID_CASHADDR_NO_PREFIX = "qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a";
const VALID_LEGACY = "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2";

// Valid WIF (this is a well-known test WIF, DO NOT use for real funds)
const VALID_WIF = "5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ";

describe("uri.ts", () => {
  describe("isIntStr", () => {
    it.each(["0", "1", "123", "9007199254740993", "-1", "-123", "-0"])(
      "accepts valid integer string: %s",
      (input) => {
        expect(isIntStr(input)).toBe(true);
      }
    );

    it.each([
      "",
      " ",
      "1.5",
      "1e5",
      "0xff",
      "0x1",
      "abc",
      "12abc",
      "1 2",
      " 123",
      "123 ",
      "+1",
      "1_000",
      "Infinity",
      "NaN",
    ])("rejects non-integer string: %s", (input) => {
      expect(isIntStr(input)).toBe(false);
    });
  });

  describe("validateBip21Uri", () => {
    describe("cashaddr validation", () => {
      it("validates cashaddr with prefix", () => {
        const result = validateBip21Uri(VALID_CASHADDR);
        expect(result.isBip21).toBe(true);
        expect(result.isCashAddress).toBe(true);
        expect(result.isBase58Address).toBe(false);
        expect(result.address).toBe(VALID_CASHADDR);
      });

      it("validates cashaddr without prefix", () => {
        const result = validateBip21Uri(VALID_CASHADDR_NO_PREFIX);
        expect(result.isBip21).toBe(true);
        expect(result.isCashAddress).toBe(true);
        // Should add the prefix
        expect(result.address).toContain("bitcoincash:");
      });

      it("validates legacy/base58 addresses", () => {
        const result = validateBip21Uri(VALID_LEGACY);
        expect(result.isBip21).toBe(true);
        expect(result.isBase58Address).toBe(true);
        expect(result.isCashAddress).toBe(false);
        expect(result.address).toBe(VALID_LEGACY);
      });
    });

    describe("BIP21 amount parsing", () => {
      it("parses amount and converts to satoshis", () => {
        const uri = `${VALID_CASHADDR}?amount=1.5`;
        const result = validateBip21Uri(uri);
        expect(result.isBip21).toBe(true);
        expect(result.satoshis).toBe(150000000n);
      });

      it("handles zero amount", () => {
        const uri = `${VALID_CASHADDR}?amount=0`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(0n);
      });

      it("handles missing amount", () => {
        const result = validateBip21Uri(VALID_CASHADDR);
        expect(result.satoshis).toBe(undefined);
      });

      it("parses fractional BCH amounts", () => {
        const uri = `${VALID_CASHADDR}?amount=0.00001`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(1000n);
      });
    });

    describe("CashToken parameters", () => {
      it("parses token category from query", () => {
        const tokenCategory =
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const uri = `${VALID_CASHADDR}?c=${tokenCategory}`;
        const result = validateBip21Uri(uri);
        expect(result.tokenCategory).toBe(tokenCategory);
      });

      it("parses fungible token amount", () => {
        const uri = `${VALID_CASHADDR}?ft=1000`;
        const result = validateBip21Uri(uri);
        expect(result.tokenAmount).toBe(1000n);
      });
    });

    describe("edge cases", () => {
      it("rejects invalid addresses", () => {
        const result = validateBip21Uri("not-an-address");
        expect(result.isBip21).toBe(false);
        expect(result.address).toBe("");
      });

      it("handles double-prefixed addresses (bug in some wallets)", () => {
        const doublePrefix = `bitcoincash:bitcoincash:${VALID_CASHADDR_NO_PREFIX}`;
        const result = validateBip21Uri(doublePrefix);
        expect(result.isBip21).toBe(true);
      });

      it("handles prefix with legacy address (bug in some wallets)", () => {
        // Some wallets incorrectly add bitcoincash: to legacy addresses
        const badUri = `bitcoincash:${VALID_LEGACY}`;
        const result = validateBip21Uri(badUri);
        expect(result.isBip21).toBe(true);
        expect(result.isBase58Address).toBe(true);
      });
    });
  });

  describe("validateWifUri", () => {
    it("validates a correct WIF", () => {
      const result = validateWifUri(VALID_WIF);
      expect(result.isWif).toBe(true);
      expect(result.wif).toBe(VALID_WIF);
      expect(result.address).toMatch(/^bitcoincash:q/);
      expect(result.privateKey).toBeInstanceOf(Uint8Array);
    });

    it("validates WIF with bitcoincash: prefix", () => {
      const prefixedWif = `bitcoincash:${VALID_WIF}`;
      const result = validateWifUri(prefixedWif);
      expect(result.isWif).toBe(true);
      expect(result.wif).toBe(VALID_WIF); // prefix should be stripped
    });

    it("validates WIF with bch-wif: prefix", () => {
      const prefixedWif = `bch-wif:${VALID_WIF}`;
      const result = validateWifUri(prefixedWif);
      expect(result.isWif).toBe(true);
      expect(result.wif).toBe(VALID_WIF);
    });

    it("rejects invalid WIF", () => {
      const result = validateWifUri("not-a-wif");
      expect(result.isWif).toBe(false);
    });

    it("rejects addresses as WIF (they look similar)", () => {
      // Legacy addresses can look like WIFs but aren't
      const result = validateWifUri(VALID_LEGACY);
      expect(result.isWif).toBe(false);
    });
  });

  describe("validateWalletConnectUri", () => {
    it("validates WalletConnect v2 URI", () => {
      const wcUri = "wc:a1b2c3d4e5f6@2?relay-protocol=irn&symKey=abc123";
      const result = validateWalletConnectUri(wcUri);
      expect(result.isWalletConnect).toBe(true);
      expect(result.wcUri).toBe(wcUri);
    });

    it("rejects non-WalletConnect URIs", () => {
      const result = validateWalletConnectUri(VALID_CASHADDR);
      expect(result.isWalletConnect).toBe(false);
    });

    it("rejects http/https URIs", () => {
      const result = validateWalletConnectUri("https://example.com");
      expect(result.isWalletConnect).toBe(false);
    });

    it("handles empty string without throwing", () => {
      const result = validateWalletConnectUri("");
      expect(result.isWalletConnect).toBe(false);
    });

    it.each(["not a uri at all", ":::invalid:::", " "])(
      "rejects malformed input without throwing: %s",
      (input) => {
        const result = validateWalletConnectUri(input);
        expect(result.isWalletConnect).toBe(false);
      }
    );
  });

  describe("validateBchUri (combined validator)", () => {
    it("identifies cashaddr as BIP21", () => {
      const result = validateBchUri(VALID_CASHADDR);
      expect(result.isValid).toBe(true);
      expect(result.isBip21).toBe(true);
    });

    it("identifies WIF correctly", () => {
      const result = validateBchUri(VALID_WIF);
      expect(result.isValid).toBe(true);
      expect(result.isWif).toBe(true);
    });

    it("identifies WalletConnect URI correctly", () => {
      const wcUri = "wc:abc123@2?relay-protocol=irn";
      const result = validateBchUri(wcUri);
      expect(result.isValid).toBe(true);
      expect(result.isWalletConnect).toBe(true);
    });

    it("identifies Payment Protocol URI", () => {
      const ppUri = "bitcoincash:?r=https://merchant.com/pay/123";
      const result = validateBchUri(ppUri);
      expect(result.isValid).toBe(true);
      expect(result.isPaymentProtocol).toBe(true);
    });

    it("rejects completely invalid input", () => {
      const result = validateBchUri("hello world");
      expect(result.isValid).toBe(false);
    });
  });

  describe("PayPro CHIP-2023-05 parameters", () => {
    describe("satoshi amount (s parameter)", () => {
      it("parses satoshi amount from s parameter", () => {
        const uri = `${VALID_CASHADDR}?s=100000`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(100000n);
      });

      it("prefers s over amount when both present", () => {
        const uri = `${VALID_CASHADDR}?amount=1.0&s=50000`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(50000n);
      });

      it("falls back to converted amount when s not present", () => {
        const uri = `${VALID_CASHADDR}?amount=1.0`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(100000000n); // 1 BCH = 100,000,000 sats
      });
    });

    describe("fungible token amount (f parameter)", () => {
      it("parses f parameter for fungible tokens", () => {
        const tokenCategory =
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const uri = `${VALID_CASHADDR}?c=${tokenCategory}&f=1000`;
        const result = validateBip21Uri(uri);
        expect(result.tokenAmount).toBe(1000n);
      });

      it("accepts ft for backward compatibility", () => {
        const tokenCategory =
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const uri = `${VALID_CASHADDR}?c=${tokenCategory}&ft=500`;
        const result = validateBip21Uri(uri);
        expect(result.tokenAmount).toBe(500n);
      });

      it("prefers f over ft when both present", () => {
        const tokenCategory =
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const uri = `${VALID_CASHADDR}?c=${tokenCategory}&f=1000&ft=500`;
        const result = validateBip21Uri(uri);
        expect(result.tokenAmount).toBe(1000n);
      });
    });

    describe("NFT commitment (n parameter)", () => {
      it("parses specific NFT commitment", () => {
        const tokenCategory =
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const commitment = "deadbeef";
        const uri = `${VALID_CASHADDR}?c=${tokenCategory}&n=${commitment}`;
        const result = validateBip21Uri(uri);
        expect(result.nftCommitment).toBe(commitment);
      });

      it("parses empty string as any NFT", () => {
        const tokenCategory =
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const uri = `${VALID_CASHADDR}?c=${tokenCategory}&n=`;
        const result = validateBip21Uri(uri);
        expect(result.nftCommitment).toBe("");
      });

      it("returns undefined when n parameter not present", () => {
        const tokenCategory =
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const uri = `${VALID_CASHADDR}?c=${tokenCategory}`;
        const result = validateBip21Uri(uri);
        expect(result.nftCommitment).toBe(undefined);
      });
    });

    describe("message/memo (m parameter)", () => {
      it("parses message parameter", () => {
        const uri = `${VALID_CASHADDR}?m=Coffee`;
        const result = validateBip21Uri(uri);
        expect(result.message).toBe("Coffee");
      });

      it("accepts message as alias for m", () => {
        const uri = `${VALID_CASHADDR}?message=Payment%20for%20lunch`;
        const result = validateBip21Uri(uri);
        expect(result.message).toBe("Payment for lunch");
      });

      it("prefers m over message when both present", () => {
        const uri = `${VALID_CASHADDR}?m=Coffee&message=Tea`;
        const result = validateBip21Uri(uri);
        expect(result.message).toBe("Coffee");
      });

      it("returns undefined when message not present", () => {
        const result = validateBip21Uri(VALID_CASHADDR);
        expect(result.message).toBe(undefined);
      });
    });

    describe("expiration (e parameter)", () => {
      it("parses expiration timestamp", () => {
        const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
        const uri = `${VALID_CASHADDR}?e=${futureTime}`;
        const result = validateBip21Uri(uri);
        expect(result.expiration).toBe(futureTime);
        expect(result.isExpired).toBe(false);
      });

      it("detects expired URIs", () => {
        const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour in past
        const uri = `${VALID_CASHADDR}?e=${pastTime}`;
        const result = validateBip21Uri(uri);
        expect(result.expiration).toBe(pastTime);
        expect(result.isExpired).toBe(true);
      });

      it("returns undefined expiration when not present", () => {
        const result = validateBip21Uri(VALID_CASHADDR);
        expect(result.expiration).toBe(undefined);
        expect(result.isExpired).toBe(false);
      });
    });
  });

  describe("alphanumeric URI encoding (CHIP-2023-05)", () => {
    describe("toAlphanumericUri", () => {
      it("encodes URI to alphanumeric format", () => {
        const uri = "bitcoincash:qtest?s=100000&m=coffee";
        const expected = "BITCOINCASH:QTEST:S-100000+M-COFFEE";
        expect(toAlphanumericUri(uri)).toBe(expected);
      });

      it("encodes address-only URI", () => {
        const uri = "bitcoincash:qtest";
        const expected = "BITCOINCASH:QTEST";
        expect(toAlphanumericUri(uri)).toBe(expected);
      });

      it("encodes URI with multiple parameters", () => {
        const uri = "bitcoincash:qtest?s=100000&m=coffee&e=1234567890";
        const expected = "BITCOINCASH:QTEST:S-100000+M-COFFEE+E-1234567890";
        expect(toAlphanumericUri(uri)).toBe(expected);
      });
    });

    describe("fromAlphanumericUri", () => {
      it("decodes alphanumeric QR format", () => {
        const alphanumeric = "BITCOINCASH:QTEST:S-100000+M-COFFEE";
        const expected = "bitcoincash:qtest?s=100000&m=coffee";
        expect(fromAlphanumericUri(alphanumeric)).toBe(expected);
      });

      it("decodes address-only URI", () => {
        const alphanumeric = "BITCOINCASH:QTEST";
        const expected = "bitcoincash:qtest";
        expect(fromAlphanumericUri(alphanumeric)).toBe(expected);
      });

      it("decodes URI with multiple parameters", () => {
        const alphanumeric = "BITCOINCASH:QTEST:S-100000+M-COFFEE+E-1234567890";
        const expected = "bitcoincash:qtest?s=100000&m=coffee&e=1234567890";
        expect(fromAlphanumericUri(alphanumeric)).toBe(expected);
      });

      it("lowercases all-uppercase input with no colon", () => {
        expect(fromAlphanumericUri("JUSTUPPERCASE")).toBe("justuppercase");
      });

      it("passes through mixed-case URIs unchanged", () => {
        const uri = "bitcoinCash:qtest?s=100000";
        expect(fromAlphanumericUri(uri)).toBe(uri);
      });

      it("passes through lowercase URIs unchanged", () => {
        const uri = "bitcoincash:qtest?s=100000";
        expect(fromAlphanumericUri(uri)).toBe(uri);
      });
    });

    describe("malicious input (BigInt guard)", () => {
      it("rejects non-numeric s parameter", () => {
        const uri = `${VALID_CASHADDR}?s=abc`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(undefined);
      });

      it("rejects decimal s parameter", () => {
        const uri = `${VALID_CASHADDR}?s=12.5`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(undefined);
      });

      it("rejects scientific notation s parameter", () => {
        const uri = `${VALID_CASHADDR}?s=1e5`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(undefined);
      });

      it("rejects hex s parameter", () => {
        const uri = `${VALID_CASHADDR}?s=0xff`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(undefined);
      });

      it("falls back to amount when s is invalid", () => {
        const uri = `${VALID_CASHADDR}?amount=1.0&s=evil`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(100000000n);
      });

      it("handles large BigInt s values safely", () => {
        const uri = `${VALID_CASHADDR}?s=9007199254740993`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(9007199254740993n);
      });

      it("rejects non-numeric f parameter", () => {
        const uri = `${VALID_CASHADDR}?f=abc`;
        const result = validateBip21Uri(uri);
        expect(result.tokenAmount).toBe(0n);
      });

      it("rejects decimal f parameter", () => {
        const uri = `${VALID_CASHADDR}?f=12.5`;
        const result = validateBip21Uri(uri);
        expect(result.tokenAmount).toBe(0n);
      });

      it("rejects non-numeric ft parameter", () => {
        const uri = `${VALID_CASHADDR}?ft=abc`;
        const result = validateBip21Uri(uri);
        expect(result.tokenAmount).toBe(0n);
      });

      it("accepts negative s parameter", () => {
        const uri = `${VALID_CASHADDR}?s=-100`;
        const result = validateBip21Uri(uri);
        expect(result.satoshis).toBe(-100n);
      });
    });

    describe("roundtrip", () => {
      it("roundtrips correctly with query parameters", () => {
        const original = "bitcoincash:qtest?s=100000&m=coffee";
        const encoded = toAlphanumericUri(original);
        const decoded = fromAlphanumericUri(encoded);
        expect(decoded).toBe(original);
      });

      it("roundtrips correctly without query parameters", () => {
        const original = "bitcoincash:qtest";
        const encoded = toAlphanumericUri(original);
        const decoded = fromAlphanumericUri(encoded);
        expect(decoded).toBe(original);
      });

      it("roundtrips with real cashaddr", () => {
        const original = `${VALID_CASHADDR}?s=50000&m=donation`;
        const encoded = toAlphanumericUri(original);
        const decoded = fromAlphanumericUri(encoded);
        expect(decoded).toBe(original);
      });
    });

    // ── Property-based roundtrip ────────────────────────────────────
    describe("property: alphanumeric roundtrip", () => {
      const safeValueArb = fc.stringMatching(/^[a-z0-9]{1,20}$/);

      it("roundtrips address-only URIs", () => {
        fc.assert(
          fc.property(safeValueArb, (addr) => {
            const uri = `bitcoincash:${addr}`;
            const decoded = fromAlphanumericUri(toAlphanumericUri(uri));
            expect(decoded).toBe(uri);
          }),
          { numRuns: 200 }
        );
      });

      it("roundtrips URIs with all parameter combinations", () => {
        fc.assert(
          fc.property(
            safeValueArb,
            fc.bigInt({ min: 0n, max: 2100000000000000n }),
            safeValueArb,
            fc.option(safeValueArb),
            (addr, sats, msg, cat) => {
              let uri = `bitcoincash:${addr}?s=${sats}&m=${msg}`;
              if (cat !== null) {
                uri += `&c=${cat}`;
              }
              const decoded = fromAlphanumericUri(toAlphanumericUri(uri));
              expect(decoded).toBe(uri);
            }
          ),
          { numRuns: 200 }
        );
      });

      it("send-max: full balance amount survives roundtrip", () => {
        fc.assert(
          fc.property(
            fc.bigInt({ min: 546n, max: 2100000000000000n }),
            (sats) => {
              const uri = `bitcoincash:qtest?s=${sats}`;
              const decoded = fromAlphanumericUri(toAlphanumericUri(uri));
              expect(decoded).toBe(uri);
            }
          ),
          { numRuns: 300 }
        );
      });
    });
  });
});

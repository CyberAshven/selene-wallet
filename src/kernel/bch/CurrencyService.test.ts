import { describe, it, expect } from "vitest";
import CurrencyService from "./CurrencyService";

const mockRates = [
  { currency: "USD", price: "300" },
  { currency: "EUR", price: "270" },
];

describe("CurrencyService", () => {
  describe("getExchangeRate", () => {
    it("returns 1 for unknown currency (safe fallback)", () => {
      const svc = CurrencyService("USD", mockRates);
      expect(svc.getExchangeRate("XYZ")).toBe(1);
    });
  });

  describe("fiatToSats", () => {
    it("converts $1 at 300 USD/BCH to 333333 sats", () => {
      const svc = CurrencyService("USD", mockRates);
      // 1/300 BCH = 0.00333333 BCH = 333333 sats (truncated)
      expect(svc.fiatToSats(1)).toBe(333333n);
    });

    it("converts 0 fiat to 0 sats", () => {
      const svc = CurrencyService("USD", mockRates);
      expect(svc.fiatToSats(0)).toBe(0n);
    });
  });

  describe("satsToFiat", () => {
    it("converts 100M sats to $300.00", () => {
      const svc = CurrencyService("USD", mockRates);
      expect(svc.satsToFiat(100000000n)).toBe("300.00");
    });

    it("truncates sub-cent amounts to 0.00", () => {
      const svc = CurrencyService("USD", mockRates);
      expect(svc.satsToFiat(1n)).toBe("0.00");
    });

    it("uses correct decimals for EUR", () => {
      const svc = CurrencyService("EUR", mockRates);
      // 50M sats = 0.5 BCH * 270 = 135 EUR
      expect(svc.satsToFiat(50000000n)).toBe("135.00");
    });
  });

  describe("fiatToSats → satsToFiat roundtrip", () => {
    it("is consistent within truncation tolerance", () => {
      const svc = CurrencyService("USD", mockRates);
      const sats = svc.fiatToSats(100);
      const fiatBack = Number(svc.satsToFiat(sats));
      // roundtrip loses at most 1 cent due to satoshi truncation
      expect(Math.abs(fiatBack - 100)).toBeLessThanOrEqual(0.01);
    });
  });
});

import { describe, it, expect } from "vitest";
import { numDecimalPlaces, truncateDecimals, getMaxDecimals } from "./currency";

describe("numDecimalPlaces", () => {
  it("returns 0 for integer strings", () => {
    expect(numDecimalPlaces("123")).toBe(0);
    expect(numDecimalPlaces("0")).toBe(0);
  });

  it("returns correct count for decimal strings", () => {
    expect(numDecimalPlaces("1.5")).toBe(1);
    expect(numDecimalPlaces("1.23")).toBe(2);
    expect(numDecimalPlaces("0.12345678")).toBe(8);
  });

  it("handles trailing decimal point", () => {
    expect(numDecimalPlaces("1.")).toBe(0);
  });
});

describe("truncateDecimals", () => {
  it("truncates to specified decimal places", () => {
    expect(truncateDecimals("1.23456", 2)).toBe("1.23");
    expect(truncateDecimals("1.99999", 2)).toBe("1.99");
  });

  it("rounds down, not up", () => {
    expect(truncateDecimals("1.999", 2)).toBe("1.99");
    expect(truncateDecimals("1.996", 2)).toBe("1.99");
  });

  it("preserves fewer decimals than max", () => {
    expect(truncateDecimals("1.2", 4)).toBe("1.2");
    expect(truncateDecimals("1", 4)).toBe("1");
  });

  it("handles zero max decimals", () => {
    expect(truncateDecimals("1.99", 0)).toBe("1");
    expect(truncateDecimals("9.99", 0)).toBe("9");
  });

  it("handles empty or invalid input", () => {
    expect(truncateDecimals("", 2)).toBe("0");
    expect(truncateDecimals("abc", 2)).toBe("0");
  });
});

describe("getMaxDecimals", () => {
  it("returns local currency decimals in stablecoin mode", () => {
    expect(
      getMaxDecimals({
        shouldPreferLocalCurrency: false,
        isStablecoinMode: true,
        denomination: "bch",
        localCurrency: "USD",
      })
    ).toBe(2);
  });

  it("returns local currency decimals when preferring local currency", () => {
    expect(
      getMaxDecimals({
        shouldPreferLocalCurrency: true,
        isStablecoinMode: false,
        denomination: "bch",
        localCurrency: "BHD",
      })
    ).toBe(3);
  });

  it("defaults to USD decimals when localCurrency is undefined", () => {
    expect(
      getMaxDecimals({
        shouldPreferLocalCurrency: true,
        isStablecoinMode: false,
        denomination: "bch",
      })
    ).toBe(2);
  });

  it("uses token denomination even when preferring local currency", () => {
    expect(
      getMaxDecimals({
        shouldPreferLocalCurrency: true,
        isStablecoinMode: false,
        denomination: "token",
        localCurrency: "USD",
        tokenDecimals: 6,
      })
    ).toBe(6);
  });

  it("returns 0 for sats denomination", () => {
    expect(
      getMaxDecimals({
        shouldPreferLocalCurrency: false,
        isStablecoinMode: false,
        denomination: "sats",
      })
    ).toBe(0);
  });

  it("returns 2 for bits denomination", () => {
    expect(
      getMaxDecimals({
        shouldPreferLocalCurrency: false,
        isStablecoinMode: false,
        denomination: "bits",
      })
    ).toBe(2);
  });

  it("returns 5 for mbch denomination", () => {
    expect(
      getMaxDecimals({
        shouldPreferLocalCurrency: false,
        isStablecoinMode: false,
        denomination: "mbch",
      })
    ).toBe(5);
  });

  it("returns 8 for bch denomination", () => {
    expect(
      getMaxDecimals({
        shouldPreferLocalCurrency: false,
        isStablecoinMode: false,
        denomination: "bch",
      })
    ).toBe(8);
  });

  it("returns 0 for token denomination with no tokenDecimals", () => {
    expect(
      getMaxDecimals({
        shouldPreferLocalCurrency: false,
        isStablecoinMode: false,
        denomination: "token",
      })
    ).toBe(0);
  });

  it("returns tokenDecimals for token denomination", () => {
    expect(
      getMaxDecimals({
        shouldPreferLocalCurrency: false,
        isStablecoinMode: false,
        denomination: "token",
        tokenDecimals: 9,
      })
    ).toBe(9);
  });
});

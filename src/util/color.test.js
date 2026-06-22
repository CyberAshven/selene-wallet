import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  getLuminance,
  getContrastRatio,
  getHighContrastBackground,
} from "./color";

describe("hexToRgb", () => {
  it("parses 6-digit hex with #", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
    expect(hexToRgb("#00ff00")).toEqual([0, 255, 0]);
    expect(hexToRgb("#0000ff")).toEqual([0, 0, 255]);
  });

  it("parses 6-digit hex without #", () => {
    expect(hexToRgb("ff0000")).toEqual([255, 0, 0]);
  });

  it("parses 3-digit shorthand hex", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#000")).toEqual([0, 0, 0]);
    expect(hexToRgb("#f00")).toEqual([255, 0, 0]);
  });

  it("parses black and white", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
  });

  it("returns black for undefined/null input", () => {
    expect(hexToRgb(undefined)).toEqual([0, 0, 0]);
    expect(hexToRgb(null)).toEqual([0, 0, 0]);
    expect(hexToRgb("")).toEqual([0, 0, 0]);
  });
});

describe("rgbToHex", () => {
  it("converts RGB to hex string", () => {
    expect(rgbToHex(255, 0, 0)).toBe("ff0000");
    expect(rgbToHex(0, 255, 0)).toBe("00ff00");
    expect(rgbToHex(0, 0, 255)).toBe("0000ff");
  });

  it("pads single-digit channels with zero", () => {
    expect(rgbToHex(0, 0, 0)).toBe("000000");
    expect(rgbToHex(1, 2, 3)).toBe("010203");
  });

  it("roundtrips with hexToRgb", () => {
    const hex = "3a7bd5";
    const [r, g, b] = hexToRgb(hex);
    expect(rgbToHex(r, g, b)).toBe(hex);
  });
});

describe("getLuminance", () => {
  it("returns 1.0 for white", () => {
    expect(getLuminance(255, 255, 255)).toBeCloseTo(1.0, 4);
  });

  it("returns 0.0 for black", () => {
    expect(getLuminance(0, 0, 0)).toBeCloseTo(0.0, 4);
  });

  it("returns expected value for pure red", () => {
    // sRGB relative luminance of pure red = 0.2126
    expect(getLuminance(255, 0, 0)).toBeCloseTo(0.2126, 3);
  });

  it("returns expected value for pure green", () => {
    // sRGB relative luminance of pure green = 0.7152
    expect(getLuminance(0, 255, 0)).toBeCloseTo(0.7152, 3);
  });

  it("returns expected value for pure blue", () => {
    // sRGB relative luminance of pure blue = 0.0722
    expect(getLuminance(0, 0, 255)).toBeCloseTo(0.0722, 3);
  });
});

describe("getContrastRatio", () => {
  it("returns 21:1 for black vs white", () => {
    const white = getLuminance(255, 255, 255);
    const black = getLuminance(0, 0, 0);
    expect(getContrastRatio(white, black)).toBeCloseTo(21, 0);
  });

  it("returns 1:1 for identical luminance", () => {
    const lum = getLuminance(128, 128, 128);
    expect(getContrastRatio(lum, lum)).toBeCloseTo(1, 4);
  });

  it("is commutative", () => {
    const l1 = getLuminance(255, 0, 0);
    const l2 = getLuminance(0, 0, 255);
    expect(getContrastRatio(l1, l2)).toBe(getContrastRatio(l2, l1));
  });
});

describe("getHighContrastBackground", () => {
  it("returns preferred background when contrast is already sufficient", () => {
    // White text on black bg — 21:1 ratio, well above 4.5
    const result = getHighContrastBackground("#ffffff", "#000000");
    // Should barely adjust since contrast is already met
    const [r, g, b] = hexToRgb(result);
    expect(r).toBeLessThan(10);
    expect(g).toBeLessThan(10);
    expect(b).toBeLessThan(10);
  });

  it("adjusts background when contrast is insufficient", () => {
    // Light gray text on light gray bg — insufficient contrast
    const result = getHighContrastBackground("#cccccc", "#dddddd");
    const [r, g, b] = hexToRgb(result);
    // Should darken the background toward black (since fg is light)
    expect(r + g + b).toBeLessThan(200 * 3);
  });

  it("achieves at least 4.5:1 contrast ratio", () => {
    // Binary search has 0.001 precision, allow small tolerance
    const tolerance = 0.05;

    // Test various problematic combinations
    const combos = [
      ["#cccccc", "#dddddd"],
      ["#777777", "#888888"],
      ["#333333", "#444444"],
      ["#ffffff", "#eeeeee"],
    ];

    combos.forEach(([fg, bg]) => {
      const result = getHighContrastBackground(fg, bg);
      const [fgR, fgG, fgB] = hexToRgb(fg);
      const [bgR, bgG, bgB] = hexToRgb(result);
      const fgL = getLuminance(fgR, fgG, fgB);
      const bgL = getLuminance(bgR, bgG, bgB);
      expect(getContrastRatio(fgL, bgL)).toBeGreaterThanOrEqual(
        4.5 - tolerance
      );
    });
  });

  it("respects custom minimum contrast ratio", () => {
    const tolerance = 0.05;
    const result = getHighContrastBackground("#cccccc", "#dddddd", 7.0);
    const [fgR, fgG, fgB] = hexToRgb("#cccccc");
    const [bgR, bgG, bgB] = hexToRgb(result);
    const fgL = getLuminance(fgR, fgG, fgB);
    const bgL = getLuminance(bgR, bgG, bgB);
    expect(getContrastRatio(fgL, bgL)).toBeGreaterThanOrEqual(7.0 - tolerance);
  });

  it("darkens background for light foreground", () => {
    const result = getHighContrastBackground("#ffffff", "#eeeeee");
    const [r] = hexToRgb(result);
    // White fg → should push bg toward black
    expect(r).toBeLessThan(238); // 238 = 0xee
  });

  it("lightens background for dark foreground", () => {
    const result = getHighContrastBackground("#000000", "#111111");
    const [r] = hexToRgb(result);
    // Black fg → should push bg toward white
    expect(r).toBeGreaterThan(17); // 17 = 0x11
  });
});

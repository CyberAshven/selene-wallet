import { describe, it, expect } from "vitest";
import { binToHex, hexToUtf8 } from "./hex";

describe("hex.ts", () => {
  describe("binToHex", () => {
    it("converts empty buffer", () => {
      expect(binToHex(new Uint8Array([]))).toBe("");
    });

    it("converts single byte", () => {
      expect(binToHex(new Uint8Array([0xff]))).toBe("ff");
    });

    it("converts zero byte", () => {
      expect(binToHex(new Uint8Array([0x00]))).toBe("00");
    });

    it("converts multiple bytes", () => {
      expect(binToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe(
        "deadbeef"
      );
    });

    it("uses lowercase hex", () => {
      expect(binToHex(new Uint8Array([0xab, 0xcd]))).toBe("abcd");
    });

    it("converts all byte values 0x00-0xff", () => {
      const allBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        allBytes[i] = i;
      }
      const result = binToHex(allBytes);
      expect(result.length).toBe(512);
      expect(result.startsWith("000102")).toBe(true);
      expect(result.endsWith("fdfeff")).toBe(true);
    });

    it("handles typical txid-length buffer (32 bytes)", () => {
      const buf = new Uint8Array(32).fill(0xaa);
      const result = binToHex(buf);
      expect(result.length).toBe(64);
      expect(result).toBe("aa".repeat(32));
    });
  });

  describe("hexToUtf8", () => {
    it("decodes ASCII text", () => {
      // "hello" = 68 65 6c 6c 6f
      expect(hexToUtf8("68656c6c6f")).toBe("hello");
    });

    it("decodes empty hex string", () => {
      expect(hexToUtf8("")).toBe("");
    });

    it("decodes multibyte UTF-8 (emoji)", () => {
      // UTF-8 for Bitcoin symbol U+20BF: e2 82 bf
      expect(hexToUtf8("e282bf")).toBe("\u20BF");
    });
  });
});

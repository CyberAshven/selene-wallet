import { describe, it, expect } from "vitest";
import { truncate, truncateProse } from "./string";

describe("string.ts", () => {
  describe("truncate", () => {
    it("returns string unchanged when shorter than maxLength", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("returns string unchanged when equal to maxLength", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });

    it("truncates with middle ellipsis", () => {
      const result = truncate("abcdefghij", 7);
      // showLength = 7 - 3 = 4, front = 2, back = 2
      expect(result).toBe("ab...ij");
    });

    it("handles odd showLength (front gets extra char)", () => {
      const result = truncate("abcdefghij", 8);
      // showLength = 8 - 3 = 5, front = ceil(2.5) = 3, back = floor(2.5) = 2
      expect(result).toBe("abc...ij");
    });

    it("uses custom separator", () => {
      const result = truncate("abcdefghij", 6, "~");
      // showLength = 6 - 1 = 5, front = 3, back = 2
      expect(result).toBe("abc~ij");
    });

    it("returns original when maxLength is 0", () => {
      expect(truncate("hello", 0)).toBe("hello");
    });

    it("handles empty string", () => {
      expect(truncate("", 5)).toBe("");
    });

    it("handles BCH address-like strings", () => {
      const addr = "bitcoincash:qr2z7dusk64qn960merp4xr4vx40xtjsdg3ypn5cq";
      const result = truncate(addr, 20);
      expect(result.length).toBe(20);
      expect(result).toContain("...");
      expect(result.startsWith("bitcoin")).toBe(true);
      expect(result.endsWith("n5cq")).toBe(true);
    });
  });

  describe("truncateProse", () => {
    it("returns short single sentence unchanged", () => {
      expect(truncateProse("Hello world.")).toBe("Hello world.");
    });

    it("extracts first two sentences", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      expect(truncateProse(text)).toBe("First sentence. Second sentence.");
    });

    it("handles exclamation and question marks", () => {
      expect(truncateProse("Wow! Really? Third.")).toBe("Wow! Really?");
    });

    it("returns full text when no sentence punctuation", () => {
      const text = "No punctuation here";
      expect(truncateProse(text)).toBe("No punctuation here");
    });

    it("truncates at word boundary when over 140 chars", () => {
      const longSentence = "This is a very " + "long ".repeat(30) + "sentence.";
      const result = truncateProse(longSentence);
      expect(result.length).toBeLessThanOrEqual(144); // 140 + "..."
      expect(result.endsWith("...")).toBe(true);
      // Should not cut mid-word
      expect(result.slice(0, -3).endsWith(" ")).toBe(false);
    });

    it("handles text with no spaces when over 140 chars", () => {
      const noSpaces = "a".repeat(200) + ".";
      const result = truncateProse(noSpaces);
      // No space to break at, so truncates at 140 + "..."
      expect(result).toBe("a".repeat(140) + "...");
    });

    it("trims whitespace", () => {
      expect(truncateProse("  Hello world.  ")).toBe("Hello world.");
    });

    it("handles exactly 140 chars", () => {
      const text = "x".repeat(139) + ".";
      expect(truncateProse(text)).toBe(text);
    });
  });
});

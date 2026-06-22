import { describe, it, expect } from "vitest";
import { detectImageMime } from "./mime";

// Helper: create base64 from raw bytes
function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

describe("mime.js", () => {
  describe("detectImageMime", () => {
    it("detects JPEG (FF D8 FF)", () => {
      const jpeg = bytesToBase64([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(detectImageMime(jpeg)).toBe("image/jpeg");
    });

    it("detects PNG (89 50 4E 47 0D 0A 1A 0A)", () => {
      const png = bytesToBase64([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      expect(detectImageMime(png)).toBe("image/png");
    });

    it("detects GIF87a", () => {
      const gif87 = btoa("GIF87a" + "\x00".repeat(10));
      expect(detectImageMime(gif87)).toBe("image/gif");
    });

    it("detects GIF89a", () => {
      const gif89 = btoa("GIF89a" + "\x00".repeat(10));
      expect(detectImageMime(gif89)).toBe("image/gif");
    });

    it("detects WEBP (RIFF....WEBP)", () => {
      // RIFF + 4 bytes size + WEBP
      const webp = btoa("RIFF\x00\x00\x00\x00WEBP" + "\x00".repeat(10));
      expect(detectImageMime(webp)).toBe("image/webp");
    });

    it("detects BMP (BM)", () => {
      const bmp = btoa("BM" + "\x00".repeat(20));
      expect(detectImageMime(bmp)).toBe("image/bmp");
    });

    it("detects ICO (00 00 01 00)", () => {
      const ico = bytesToBase64([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]);
      expect(detectImageMime(ico)).toBe("image/x-icon");
    });

    it("detects SVG starting with <svg", () => {
      const svg = btoa('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      expect(detectImageMime(svg)).toBe("image/svg+xml");
    });

    it("detects SVG with XML declaration", () => {
      const svg = btoa(
        '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'
      );
      expect(detectImageMime(svg)).toBe("image/svg+xml");
    });

    it("returns null for unknown format", () => {
      const unknown = btoa("UNKNOWN FORMAT DATA");
      expect(detectImageMime(unknown)).toBe(null);
    });

    it("returns null for random binary data", () => {
      const random = bytesToBase64([0x01, 0x02, 0x03, 0x04, 0x05]);
      expect(detectImageMime(random)).toBe(null);
    });

    it("does not misdetect XML without svg tag", () => {
      const xml = btoa('<?xml version="1.0"?><html></html>');
      expect(detectImageMime(xml)).toBe(null);
    });
  });
});

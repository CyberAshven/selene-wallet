/* eslint-disable no-plusplus, no-bitwise */
import { binToUtf8, hexToBin, vmNumberToBigInt } from "@bitauth/libauth";

import { hexToRgb, rgbToHex } from "@/util/color";

// initialize binToHex lookup tables
const LUT_HEX_4B = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
];

const LUT_HEX_8B = new Array(0x100);
for (let n = 0; n < 0x100; n++) {
  LUT_HEX_8B[n] = `${LUT_HEX_4B[(n >>> 4) & 0xf]}${LUT_HEX_4B[n & 0xf]}`;
}

// faster (4x) binToHex implementation: https://archive.is/2v7QZ
// libauth uses slower array conversion method
export function binToHex(buffer) {
  let out = "";
  for (let idx = 0, edx = buffer.length; idx < edx; idx++) {
    out += LUT_HEX_8B[buffer[idx]];
  }
  return out;
}

// re-export libauth hexToBin
export { hexToBin };

// hexToUtf8: attempt to decode a hex string to utf8
export function hexToUtf8(hex: string) {
  return binToUtf8(hexToBin(hex));
}

// re-export internal hexToRgb and rgbToHex
export { hexToRgb, rgbToHex };

// Lexicographic byte-by-byte comparison for Uint8Array (sort comparator)
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let idx = 0; idx < len; idx++) {
    if (a[idx] < b[idx]) return -1;
    if (a[idx] > b[idx]) return 1;
  }
  return a.length - b.length;
}

/** Decode a hex string as a VM number, returning undefined on failure. */
export function hexToVmNumber(hex: string): bigint | undefined {
  const bytes = hexToBin(hex);
  const result = vmNumberToBigInt(bytes, {
    maximumVmNumberByteLength: Math.max(bytes.length, 1),
    requireMinimalEncoding: false,
  });
  return typeof result === "string" ? undefined : result;
}

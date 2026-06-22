import { stringify } from "@bitauth/libauth";

import { hexToBin } from "@/util/hex";

export { stringify };

// credit: Mathieu Geukens (Cashonize Wallet)
export function destringify(jsonString) {
  const uint8ArrayRegex = /^<Uint8Array: 0x(?<hex>[0-9a-f]*)>$/u;
  const bigIntRegex = /^<bigint: (?<bigint>[0-9]*)n>$/;

  return JSON.parse(jsonString, (_key, value) => {
    if (typeof value === "string") {
      const bigintMatch = value.match(bigIntRegex);
      if (bigintMatch?.groups?.bigint !== undefined) {
        return BigInt(bigintMatch.groups.bigint);
      }
      const uint8ArrayMatch = value.match(uint8ArrayRegex);
      if (uint8ArrayMatch?.groups?.hex !== undefined) {
        return hexToBin(uint8ArrayMatch.groups.hex);
      }
    }
    return value;
  });
}

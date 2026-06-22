import { Decimal } from "decimal.js";
import { binToValueSatoshis, excessiveSatoshis } from "@bitauth/libauth";

export const SATOSHI = 100000000n; // sats per 1 BCH
export const MAX_SATOSHI = SATOSHI * 21000000n; // 21 million
export const EXCESSIVE_SATOSHIS = binToValueSatoshis(excessiveSatoshis); // used for mock outputs
export const DUST_RELAY_FEE = 1000n; // minRelayFee in sats per kB (generally 1000 sat/kB on most nodes)
export const VALID_DENOMINATIONS = ["BCH", "sats"];

export const TXFEE_PER_BYTE = 1n;

export function satsToBch(sats: bigint | string | number | Decimal): {
  sats: bigint;
  bch: string;
} {
  return {
    sats: BigInt(sats.toString()),
    bch: new Decimal(sats).div(SATOSHI).toFixed(8, Decimal.ROUND_DOWN),
  };
}

export function bchToSats(bch, denomination = "bch"): bigint {
  if (bch === null || bch === undefined || bch === "") {
    throw new Error("bchToSats: input is required");
  }

  switch (denomination) {
    case "sats":
      return BigInt(bch.toString());

    case "bch":
    default:
      return BigInt(
        new Decimal(bch)
          .mul(SATOSHI)
          .toDecimalPlaces(0, Decimal.ROUND_DOWN)
          .toString()
      );
  }
}

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import UtxoManagerService from "./UtxoManagerService";

function makeUtxo(
  address: string,
  tx_hash: string,
  tx_pos: number,
  valueSatoshis: bigint,
  tokenCategory: string | null = null,
  tokenAmount: bigint | null = null,
  nftCapability: string | null = null,
  nftCommitment: string | null = null
) {
  return {
    address,
    tx_hash,
    tx_pos,
    valueSatoshis,
    memo: null,
    token_category: tokenCategory,
    token_amount: tokenAmount,
    nft_capability: nftCapability,
    nft_commitment: nftCommitment,
  };
}

// Build a mock DB that routes queries by SQL pattern.
// selectCoins calls getWalletCoins, walletDb.exec("SELECT * FROM addresses"),
// and getAddressCoins — each with different SQL.
function makeMockDb(opts: {
  coins?: ReturnType<typeof makeUtxo>[];
  addresses?: { address: string; balance: bigint }[];
  addressCoins?: Record<string, ReturnType<typeof makeUtxo>[]>;
}) {
  const coins = opts.coins ?? [];
  const addresses = opts.addresses ?? [];
  const addressCoins = opts.addressCoins ?? {};

  return {
    exec: vi.fn((sql: string, params?: unknown[]) => {
      // getWalletCoins: non-token UTXOs (no address filter)
      if (sql.includes("token_category IS NULL") && !sql.includes("address=?"))
        return [...coins];
      // getAddressCoins: non-token UTXOs for specific address (ORDER BY valueSatoshis ASC)
      if (sql.includes("token_category IS NULL") && sql.includes("address=?"))
        return [...(addressCoins[params?.[0] as string] ?? [])].sort((a, b) =>
          a.valueSatoshis < b.valueSatoshis
            ? -1
            : a.valueSatoshis > b.valueSatoshis
              ? 1
              : 0
        );
      // getCategoryUtxos: token UTXOs for specific category
      if (sql.includes("token_category=?")) return [...coins];
      // selectCoins address-balance query: WHERE balance >= ? ORDER BY balance ASC
      if (sql.includes("FROM addresses")) {
        const threshold = BigInt(params?.[0] as string);
        return addresses
          .filter((a) => a.balance >= threshold)
          .sort((a, b) =>
            a.balance < b.balance ? -1 : a.balance > b.balance ? 1 : 0
          );
      }
      return [];
    }),
    run: vi.fn(),
    export: vi.fn(() => new Uint8Array()),
    close: vi.fn(),
    path: "test.db",
  };
}

describe("UtxoManagerService", () => {
  // ── targetUtxos: greedy accumulation algorithm ─────────────────────
  describe("targetUtxos", () => {
    it("returns empty when sum is below target", () => {
      const db = makeMockDb({});
      const svc = UtxoManagerService("test", db);

      const utxos = [makeUtxo("a", "t1", 0, 500n)];
      const result = svc.targetUtxos(utxos, 1000n);
      expect(result.selection).toEqual([]);
    });

    it("returns exact match with zero change", () => {
      const db = makeMockDb({});
      const svc = UtxoManagerService("test", db);

      const utxos = [makeUtxo("a", "t1", 0, 1000n)];
      const result = svc.targetUtxos(utxos, 1000n);
      expect(result.selection).toHaveLength(1);
      expect(result.changeAmount).toBe(0n);
    });

    it("calculates correct change on overshoot", () => {
      const db = makeMockDb({});
      const svc = UtxoManagerService("test", db);

      const utxos = [makeUtxo("a", "t1", 0, 3000n)];
      const result = svc.targetUtxos(utxos, 1000n);
      expect(result.changeAmount).toBe(2000n);
    });

    it("accumulates multiple UTXOs to reach target", () => {
      const db = makeMockDb({});
      const svc = UtxoManagerService("test", db);

      const utxos = [
        makeUtxo("a", "t1", 0, 400n),
        makeUtxo("a", "t2", 0, 400n),
        makeUtxo("a", "t3", 0, 400n),
      ];
      const result = svc.targetUtxos(utxos, 1000n);
      expect(result.selection).toHaveLength(3);
      expect(result.changeAmount).toBe(200n);
    });
  });

  // ── selectTokens: threshold then accumulation ──────────────────────
  describe("selectTokens", () => {
    it("returns empty when target is 0", () => {
      const db = makeMockDb({
        coins: [makeUtxo("a", "t1", 0, 546n, "cat1", 100n)],
      });
      const svc = UtxoManagerService("test", db);
      expect(svc.selectTokens("cat1", 0n)).toEqual([]);
    });

    it("returns empty when insufficient tokens", () => {
      const db = makeMockDb({
        coins: [makeUtxo("a", "t1", 0, 546n, "cat1", 50n)],
      });
      const svc = UtxoManagerService("test", db);
      expect(svc.selectTokens("cat1", 100n)).toEqual([]);
    });

    it("picks smallest single UTXO >= target (threshold)", () => {
      // getCategoryUtxos returns DESC by token_amount
      // [200, 150, 50] — filter(>= 100) = [200, 150] — .pop() = 150
      const db = makeMockDb({
        coins: [
          makeUtxo("a", "t1", 0, 546n, "cat1", 200n),
          makeUtxo("a", "t2", 0, 546n, "cat1", 150n),
          makeUtxo("a", "t3", 0, 546n, "cat1", 50n),
        ],
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectTokens("cat1", 100n);
      expect(result).toHaveLength(1);
      expect(result[0].token_amount).toBe(150n);
    });

    it("accumulates when no single UTXO suffices", () => {
      const db = makeMockDb({
        coins: [
          makeUtxo("a", "t1", 0, 546n, "cat1", 40n),
          makeUtxo("a", "t2", 0, 546n, "cat1", 30n),
          makeUtxo("a", "t3", 0, 546n, "cat1", 35n),
        ],
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectTokens("cat1", 60n);
      const total = result.reduce((s, u) => s + (u.token_amount ?? 0n), 0n);
      expect(total).toBeGreaterThanOrEqual(60n);
    });

    // ── hybrid UTXO preference ────────────────────────────────────────
    it("prefers pure-FT over hybrid when pure-FT is sufficient", () => {
      // Pure-FT: 200, Hybrid: 500 (NFT+FT). Target 100.
      // Should pick the pure-FT (200) not the hybrid (500).
      const db = makeMockDb({
        coins: [
          makeUtxo("a", "t1", 0, 546n, "cat1", 500n, "none", "ab"),
          makeUtxo("a", "t2", 0, 546n, "cat1", 200n),
        ],
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectTokens("cat1", 100n);
      expect(result).toHaveLength(1);
      expect(result[0].nft_capability).toBeNull();
      expect(result[0].token_amount).toBe(200n);
    });

    it("falls back to hybrid when pure-FT is insufficient", () => {
      // Pure-FT: 50, Hybrid: 500 (NFT+FT). Target 100.
      // Pure-FT can't cover it, so must use hybrid.
      const db = makeMockDb({
        coins: [
          makeUtxo("a", "t1", 0, 546n, "cat1", 500n, "none", "ab"),
          makeUtxo("a", "t2", 0, 546n, "cat1", 50n),
        ],
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectTokens("cat1", 100n);
      expect(result).toHaveLength(1);
      expect(result[0].nft_capability).toBe("none");
    });

    it("accumulates pure-FT before touching hybrid", () => {
      // Two pure-FT: 60 + 60 = 120. Hybrid: 300. Target 100.
      // Should accumulate both pure-FT, not use hybrid.
      const db = makeMockDb({
        coins: [
          makeUtxo("a", "t1", 0, 546n, "cat1", 300n, "mutable", null),
          makeUtxo("a", "t2", 0, 546n, "cat1", 60n),
          makeUtxo("a", "t3", 0, 546n, "cat1", 60n),
        ],
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectTokens("cat1", 100n);
      expect(result).toHaveLength(2);
      result.forEach((u) => expect(u.nft_capability).toBeNull());
    });

    it("works when only hybrid UTXOs exist", () => {
      const db = makeMockDb({
        coins: [
          makeUtxo("a", "t1", 0, 546n, "cat1", 300n, "none", "01"),
          makeUtxo("a", "t2", 0, 546n, "cat1", 200n, "none", "02"),
        ],
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectTokens("cat1", 100n);
      expect(result).toHaveLength(1);
      const total = result.reduce((s, u) => s + (u.token_amount ?? 0n), 0n);
      expect(total).toBeGreaterThanOrEqual(100n);
    });

    // ── send max ──────────────────────────────────────────────────────
    it("send max: selects all pure-FT UTXOs when target equals total", () => {
      const db = makeMockDb({
        coins: [
          makeUtxo("a", "t1", 0, 546n, "cat1", 300n),
          makeUtxo("a", "t2", 0, 546n, "cat1", 200n),
          makeUtxo("a", "t3", 0, 546n, "cat1", 100n),
        ],
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectTokens("cat1", 600n);
      const total = result.reduce((s, u) => s + (u.token_amount ?? 0n), 0n);
      expect(total).toBe(600n);
    });

    it("send max: includes hybrid UTXOs when needed for full amount", () => {
      // Pure-FT: 200, Hybrid: 300+NFT. Total = 500. Target = 500.
      const db = makeMockDb({
        coins: [
          makeUtxo("a", "t1", 0, 546n, "cat1", 300n, "none", "ab"),
          makeUtxo("a", "t2", 0, 546n, "cat1", 200n),
        ],
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectTokens("cat1", 500n);
      const total = result.reduce((s, u) => s + (u.token_amount ?? 0n), 0n);
      expect(total).toBe(500n);
    });

    it("send max: single UTXO threshold still works at exact amount", () => {
      const db = makeMockDb({
        coins: [makeUtxo("a", "t1", 0, 546n, "cat1", 100n)],
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectTokens("cat1", 100n);
      expect(result).toHaveLength(1);
      expect(result[0].token_amount).toBe(100n);
    });
  });

  // ── selectCoins: multi-strategy UTXO selection ─────────────────────
  describe("selectCoins", () => {
    it("returns empty when wallet has insufficient funds", () => {
      const db = makeMockDb({
        coins: [makeUtxo("a", "t1", 0, 500n)],
      });
      const svc = UtxoManagerService("test", db);
      expect(svc.selectCoins(1000n)).toEqual([]);
    });

    it("returns empty when target is 0", () => {
      const db = makeMockDb({
        coins: [makeUtxo("a", "t1", 0, 1000n)],
      });
      const svc = UtxoManagerService("test", db);
      expect(svc.selectCoins(0n)).toEqual([]);
    });

    it("strategy 1: exact UTXO match spends all coins on that address", () => {
      const addr1coins = [
        makeUtxo("addr1", "t1", 0, 5000n),
        makeUtxo("addr1", "t2", 0, 3000n),
      ];
      const db = makeMockDb({
        coins: [...addr1coins, makeUtxo("addr2", "t3", 0, 9000n)],
        addressCoins: { addr1: addr1coins },
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectCoins(5000n);
      expect(result).toHaveLength(2);
      expect(result.every((u) => u.address === "addr1")).toBe(true);
    });

    it("strategy 2: exact address balance spends entire address", () => {
      const addr2coins = [
        makeUtxo("addr2", "t3", 0, 3000n),
        makeUtxo("addr2", "t4", 0, 2000n),
      ];
      const db = makeMockDb({
        coins: [
          makeUtxo("addr1", "t1", 0, 1000n),
          makeUtxo("addr1", "t2", 0, 2000n),
          ...addr2coins,
        ],
        addresses: [{ address: "addr2", balance: 5000n }],
        addressCoins: { addr2: addr2coins },
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectCoins(5000n);
      expect(result).toHaveLength(2);
      expect(result.every((u) => u.address === "addr2")).toBe(true);
    });

    it("strategy 3: falls back to consolidation across UTXOs", () => {
      const db = makeMockDb({
        coins: [
          makeUtxo("a", "t1", 0, 3000n),
          makeUtxo("b", "t2", 0, 4000n),
          makeUtxo("c", "t3", 0, 2000n),
        ],
        addresses: [],
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectCoins(6000n);
      const total = result.reduce((s, u) => s + u.valueSatoshis, 0n);
      expect(total).toBeGreaterThanOrEqual(6000n);
    });

    it("prefers fewer-input address spend over consolidation", () => {
      const addr1coins = [makeUtxo("addr1", "t3", 0, 8000n)];
      const db = makeMockDb({
        coins: [
          makeUtxo("addr2", "t1", 0, 3000n),
          makeUtxo("addr3", "t2", 0, 3000n),
          ...addr1coins,
        ],
        addresses: [{ address: "addr1", balance: 8000n }],
        addressCoins: { addr1: addr1coins },
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectCoins(7000n);
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("addr1");
    });

    // ── send max ──────────────────────────────────────────────────────
    it("send max: selects all UTXOs when target equals total balance", () => {
      const coins = [
        makeUtxo("a", "t1", 0, 3000n),
        makeUtxo("a", "t2", 0, 4000n),
        makeUtxo("a", "t3", 0, 2000n),
      ];
      const db = makeMockDb({
        coins,
        addresses: [{ address: "a", balance: 9000n }],
        addressCoins: { a: coins },
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectCoins(9000n);
      const total = result.reduce((s, u) => s + u.valueSatoshis, 0n);
      expect(total).toBe(9000n);
    });

    it("send max: single UTXO wallet spends entire balance", () => {
      const coins = [makeUtxo("a", "t1", 0, 50000n)];
      const db = makeMockDb({
        coins,
        addresses: [{ address: "a", balance: 50000n }],
        addressCoins: { a: coins },
      });
      const svc = UtxoManagerService("test", db);
      const result = svc.selectCoins(50000n);
      expect(result).toHaveLength(1);
      expect(result[0].valueSatoshis).toBe(50000n);
    });
  });

  // ── Property-based fuzz tests ─────────────────────────────────────

  const utxoArb = fc.record({
    address: fc.stringMatching(/^addr[0-9]$/),
    tx_hash: fc.stringMatching(/^[0-9a-f]{64}$/),
    tx_pos: fc.nat({ max: 10 }),
    valueSatoshis: fc.bigInt({ min: 546n, max: 1_000_000_000n }),
  });
  const utxoSetArb = fc.array(utxoArb, { minLength: 1, maxLength: 20 });

  describe("property: targetUtxos", () => {
    it("sufficient funds always covers target with correct change", () => {
      fc.assert(
        fc.property(
          utxoSetArb,
          fc.bigInt({ min: 546n, max: 500_000_000n }),
          (utxoData, target) => {
            const utxos = utxoData.map((u) =>
              makeUtxo(u.address, u.tx_hash, u.tx_pos, u.valueSatoshis)
            );
            const sum = utxos.reduce((s, u) => s + u.valueSatoshis, 0n);
            if (sum < target) return;

            const db = makeMockDb({});
            const svc = UtxoManagerService("test", db);
            const result = svc.targetUtxos([...utxos], target);

            const selectedSum = result.selection.reduce(
              (s, u) => s + u.valueSatoshis,
              0n
            );
            expect(selectedSum).toBeGreaterThanOrEqual(target);
            expect(result.changeAmount).toBe(selectedSum - target);
          }
        ),
        { numRuns: 200 }
      );
    });

    it("insufficient funds always returns empty selection", () => {
      fc.assert(
        fc.property(utxoSetArb, (utxoData) => {
          const utxos = utxoData.map((u) =>
            makeUtxo(u.address, u.tx_hash, u.tx_pos, u.valueSatoshis)
          );
          const sum = utxos.reduce((s, u) => s + u.valueSatoshis, 0n);
          const target = sum + 1n;

          const db = makeMockDb({});
          const svc = UtxoManagerService("test", db);
          const result = svc.targetUtxos([...utxos], target);

          expect(result.selection).toEqual([]);
        }),
        { numRuns: 100 }
      );
    });
  });

  function buildCoinMock(utxos: ReturnType<typeof makeUtxo>[]) {
    const byAddr: Record<string, ReturnType<typeof makeUtxo>[]> = {};
    utxos.forEach((u) => {
      (byAddr[u.address] ??= []).push(u);
    });
    const addresses = Object.entries(byAddr).map(([address, coins]) => ({
      address,
      balance: coins.reduce((s, c) => s + c.valueSatoshis, 0n),
    }));
    return makeMockDb({ coins: utxos, addresses, addressCoins: byAddr });
  }

  describe("property: selectCoins", () => {
    it("sufficient funds always selects enough", () => {
      fc.assert(
        fc.property(
          utxoSetArb,
          fc.bigInt({ min: 546n, max: 500_000_000n }),
          (utxoData, target) => {
            const utxos = utxoData.map((u) =>
              makeUtxo(u.address, u.tx_hash, u.tx_pos, u.valueSatoshis)
            );
            const sum = utxos.reduce((s, u) => s + u.valueSatoshis, 0n);
            if (sum < target) return;

            const db = buildCoinMock(utxos);
            const svc = UtxoManagerService("test", db);
            const result = svc.selectCoins(target);

            const selectedSum = result.reduce(
              (s, u) => s + u.valueSatoshis,
              0n
            );
            expect(selectedSum).toBeGreaterThanOrEqual(target);
          }
        ),
        { numRuns: 200 }
      );
    });

    it("insufficient funds always returns empty", () => {
      fc.assert(
        fc.property(utxoSetArb, (utxoData) => {
          const utxos = utxoData.map((u) =>
            makeUtxo(u.address, u.tx_hash, u.tx_pos, u.valueSatoshis)
          );
          const sum = utxos.reduce((s, u) => s + u.valueSatoshis, 0n);
          const target = sum + 1n;

          const db = buildCoinMock(utxos);
          const svc = UtxoManagerService("test", db);
          const result = svc.selectCoins(target);

          expect(result).toEqual([]);
        }),
        { numRuns: 100 }
      );
    });

    it("only crosses address boundary when every single-address option costs more inputs", () => {
      fc.assert(
        fc.property(
          utxoSetArb,
          fc.bigInt({ min: 546n, max: 500_000_000n }),
          (utxoData, target) => {
            const utxos = utxoData.map((u) =>
              makeUtxo(u.address, u.tx_hash, u.tx_pos, u.valueSatoshis)
            );
            const sum = utxos.reduce((s, u) => s + u.valueSatoshis, 0n);
            if (sum < target) return;

            const db = buildCoinMock(utxos);
            const svc = UtxoManagerService("test", db);
            const result = svc.selectCoins(target);

            const resultAddrs = new Set(result.map((u) => u.address));
            if (resultAddrs.size <= 1) return;

            const byAddr: Record<string, ReturnType<typeof makeUtxo>[]> = {};
            utxos.forEach((u) => {
              (byAddr[u.address] ??= []).push(u);
            });

            Object.entries(byAddr).forEach(([, coins]) => {
              const addrBalance = coins.reduce(
                (s, c) => s + c.valueSatoshis,
                0n
              );
              if (addrBalance < target) return;

              const sorted = [...coins].sort((a, b) =>
                a.valueSatoshis < b.valueSatoshis
                  ? -1
                  : a.valueSatoshis > b.valueSatoshis
                    ? 1
                    : 0
              );
              let remaining = target;
              let inputs = 0;
              sorted.forEach((u) => {
                if (remaining > 0n) {
                  remaining -= u.valueSatoshis;
                  inputs++;
                }
              });

              expect(inputs).toBeGreaterThan(result.length);
            });
          }
        ),
        { numRuns: 200 }
      );
    });

    it("send max: target === total always selects enough", () => {
      fc.assert(
        fc.property(utxoSetArb, (utxoData) => {
          const utxos = utxoData.map((u) =>
            makeUtxo(u.address, u.tx_hash, u.tx_pos, u.valueSatoshis)
          );
          const total = utxos.reduce((s, u) => s + u.valueSatoshis, 0n);
          if (total === 0n) return;

          const db = buildCoinMock(utxos);
          const svc = UtxoManagerService("test", db);
          const result = svc.selectCoins(total);

          const selectedSum = result.reduce((s, u) => s + u.valueSatoshis, 0n);
          expect(selectedSum).toBeGreaterThanOrEqual(total);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe("property: selectTokens", () => {
    it("sufficient tokens always selects enough", () => {
      fc.assert(
        fc.property(
          fc.array(fc.bigInt({ min: 1n, max: 1_000_000n }), {
            minLength: 1,
            maxLength: 10,
          }),
          fc.bigInt({ min: 1n, max: 500_000n }),
          (tokenAmounts, target) => {
            const sum = tokenAmounts.reduce((s, a) => s + a, 0n);
            if (sum < target) return;

            const sorted = [...tokenAmounts].sort((a, b) =>
              a > b ? -1 : a < b ? 1 : 0
            );
            const utxos = sorted.map((amt, i) =>
              makeUtxo("a", `tx${i}`, 0, 546n, "cat1", amt)
            );

            const db = makeMockDb({ coins: utxos });
            const svc = UtxoManagerService("test", db);
            const result = svc.selectTokens("cat1", target);

            const selectedSum = result.reduce(
              (s, u) => s + (u.token_amount ?? 0n),
              0n
            );
            expect(selectedSum).toBeGreaterThanOrEqual(target);
          }
        ),
        { numRuns: 200 }
      );
    });

    it("insufficient tokens always returns empty", () => {
      fc.assert(
        fc.property(
          fc.array(fc.bigInt({ min: 1n, max: 1_000_000n }), {
            minLength: 1,
            maxLength: 10,
          }),
          (tokenAmounts) => {
            const sum = tokenAmounts.reduce((s, a) => s + a, 0n);
            const target = sum + 1n;

            const sorted = [...tokenAmounts].sort((a, b) =>
              a > b ? -1 : a < b ? 1 : 0
            );
            const utxos = sorted.map((amt, i) =>
              makeUtxo("a", `tx${i}`, 0, 546n, "cat1", amt)
            );

            const db = makeMockDb({ coins: utxos });
            const svc = UtxoManagerService("test", db);
            const result = svc.selectTokens("cat1", target);

            expect(result).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("threshold prefers smallest single UTXO >= target", () => {
      fc.assert(
        fc.property(
          fc.array(fc.bigInt({ min: 1n, max: 1_000_000n }), {
            minLength: 2,
            maxLength: 10,
          }),
          fc.bigInt({ min: 1n, max: 500_000n }),
          (tokenAmounts, target) => {
            const eligible = tokenAmounts.filter((a) => a >= target);
            if (eligible.length === 0) return;

            const sorted = [...tokenAmounts].sort((a, b) =>
              a > b ? -1 : a < b ? 1 : 0
            );
            const utxos = sorted.map((amt, i) =>
              makeUtxo("a", `tx${i}`, 0, 546n, "cat1", amt)
            );

            const db = makeMockDb({ coins: utxos });
            const svc = UtxoManagerService("test", db);
            const result = svc.selectTokens("cat1", target);

            expect(result).toHaveLength(1);

            const smallestEligible = eligible.sort((a, b) =>
              a > b ? -1 : a < b ? 1 : 0
            )[eligible.length - 1];
            expect(result[0].token_amount).toBe(smallestEligible);
          }
        ),
        { numRuns: 200 }
      );
    });

    it("send max: target === total always selects enough", () => {
      fc.assert(
        fc.property(
          fc.array(fc.bigInt({ min: 1n, max: 1_000_000n }), {
            minLength: 1,
            maxLength: 10,
          }),
          (tokenAmounts) => {
            const total = tokenAmounts.reduce((s, a) => s + a, 0n);

            const sorted = [...tokenAmounts].sort((a, b) =>
              a > b ? -1 : a < b ? 1 : 0
            );
            const utxos = sorted.map((amt, i) =>
              makeUtxo("a", `tx${i}`, 0, 546n, "cat1", amt)
            );

            const db = makeMockDb({ coins: utxos });
            const svc = UtxoManagerService("test", db);
            const result = svc.selectTokens("cat1", total);

            const selectedSum = result.reduce(
              (s, u) => s + (u.token_amount ?? 0n),
              0n
            );
            expect(selectedSum).toBe(total);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  // ── Property: hybrid UTXO selection ─────────────────────────────────

  const nftCapabilityArb = fc.constantFrom("none", "mutable", "minting");

  const tokenUtxoArb = fc.record({
    amount: fc.bigInt({ min: 1n, max: 1_000_000n }),
    isHybrid: fc.boolean(),
    capability: nftCapabilityArb,
  });

  const tokenUtxoSetArb = fc.array(tokenUtxoArb, {
    minLength: 1,
    maxLength: 15,
  });

  function buildTokenPool(
    utxoData: { amount: bigint; isHybrid: boolean; capability: string }[]
  ) {
    const sorted = [...utxoData].sort((a, b) =>
      a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0
    );
    return sorted.map((u, i) =>
      makeUtxo(
        "a",
        `tx${i}`,
        0,
        546n,
        "cat1",
        u.amount,
        u.isHybrid ? u.capability : null,
        u.isHybrid ? `${i.toString(16).padStart(2, "0")}` : null
      )
    );
  }

  describe("property: selectTokens with hybrid UTXOs", () => {
    it("sufficient tokens always selects enough (mixed pool)", () => {
      fc.assert(
        fc.property(
          tokenUtxoSetArb,
          fc.bigInt({ min: 1n, max: 500_000n }),
          (utxoData, target) => {
            const sum = utxoData.reduce((s, u) => s + u.amount, 0n);
            if (sum < target) return;

            const utxos = buildTokenPool(utxoData);
            const db = makeMockDb({ coins: utxos });
            const svc = UtxoManagerService("test", db);
            const result = svc.selectTokens("cat1", target);

            const selectedSum = result.reduce(
              (s, u) => s + (u.token_amount ?? 0n),
              0n
            );
            expect(selectedSum).toBeGreaterThanOrEqual(target);
          }
        ),
        { numRuns: 200 }
      );
    });

    it("never selects hybrid UTXOs when pure-FT alone suffices", () => {
      fc.assert(
        fc.property(
          tokenUtxoSetArb,
          fc.bigInt({ min: 1n, max: 500_000n }),
          (utxoData, target) => {
            const pureFtSum = utxoData
              .filter((u) => !u.isHybrid)
              .reduce((s, u) => s + u.amount, 0n);
            if (pureFtSum < target) return;

            const utxos = buildTokenPool(utxoData);
            const db = makeMockDb({ coins: utxos });
            const svc = UtxoManagerService("test", db);
            const result = svc.selectTokens("cat1", target);

            result.forEach((u) => {
              expect(u.nft_capability).toBeNull();
            });
          }
        ),
        { numRuns: 200 }
      );
    });

    it("insufficient tokens always returns empty (mixed pool)", () => {
      fc.assert(
        fc.property(tokenUtxoSetArb, (utxoData) => {
          const sum = utxoData.reduce((s, u) => s + u.amount, 0n);
          const target = sum + 1n;

          const utxos = buildTokenPool(utxoData);
          const db = makeMockDb({ coins: utxos });
          const svc = UtxoManagerService("test", db);
          const result = svc.selectTokens("cat1", target);

          expect(result).toEqual([]);
        }),
        { numRuns: 100 }
      );
    });

    it("send max: target === total always selects enough (mixed pool)", () => {
      fc.assert(
        fc.property(tokenUtxoSetArb, (utxoData) => {
          const total = utxoData.reduce((s, u) => s + u.amount, 0n);

          const utxos = buildTokenPool(utxoData);
          const db = makeMockDb({ coins: utxos });
          const svc = UtxoManagerService("test", db);
          const result = svc.selectTokens("cat1", total);

          const selectedSum = result.reduce(
            (s, u) => s + (u.token_amount ?? 0n),
            0n
          );
          expect(selectedSum).toBe(total);
        }),
        { numRuns: 200 }
      );
    });
  });
});

import { describe, it, expect, vi } from "vitest";

vi.unmock("@/kernel/wallet/WalletManagerService");

import WalletManagerService, {
  WalletNotExistsError,
} from "./WalletManagerService";

function makeMockDb(handlers: {
  exec?: (...args: unknown[]) => unknown[];
  run?: (...args: unknown[]) => void;
}) {
  return {
    exec: handlers.exec ?? vi.fn(() => []),
    run: handlers.run ?? vi.fn(),
    export: vi.fn(() => new Uint8Array()),
    close: vi.fn(),
    path: "test.db",
  };
}

describe("WalletManagerService", () => {
  // ── calculateWalletHash: deterministic wallet identity ─────────────
  describe("calculateWalletHash", () => {
    const svc = WalletManagerService({
      appDb: makeMockDb({}),
      network: "mainnet",
    });

    const baseStub = {
      mnemonic:
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      passphrase: "",
      derivation: "m/44'/145'/0'" as const,
    };

    it("returns known-good hash for test mnemonic", () => {
      expect(svc.calculateWalletHash(baseStub)).toBe(
        "89005387c3e19649501ce8be1b2768ef9951922e77f4732775238c5d528a41a2"
      );
    });

    it("varies with mnemonic", () => {
      const alt = {
        ...baseStub,
        mnemonic: "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong",
      };
      expect(svc.calculateWalletHash(baseStub)).not.toBe(
        svc.calculateWalletHash(alt)
      );
    });

    it("varies with passphrase", () => {
      const alt = { ...baseStub, passphrase: "secret" };
      expect(svc.calculateWalletHash(baseStub)).not.toBe(
        svc.calculateWalletHash(alt)
      );
    });

    it("varies with derivation path", () => {
      const alt = { ...baseStub, derivation: "m/44'/0'/0'" as const };
      expect(svc.calculateWalletHash(baseStub)).not.toBe(
        svc.calculateWalletHash(alt)
      );
    });
  });

  // ── createTemporaryWallet: pure object creation ────────────────────
  describe("createTemporaryWallet", () => {
    it("computes hash and sets mainnet prefix", () => {
      const svc = WalletManagerService({
        appDb: makeMockDb({}),
        network: "mainnet",
      });
      const stub = {
        mnemonic:
          "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        passphrase: "",
        derivation: "m/44'/145'/0'" as const,
      };
      const wallet = svc.createTemporaryWallet(stub);

      expect(wallet.walletHash).toMatch(/^[0-9a-f]{64}$/);
      expect(wallet.prefix).toBe("bitcoincash");
      expect(wallet.network).toBe("mainnet");
      expect(wallet.mnemonic).toBe(stub.mnemonic);
    });

    it("sets bchtest prefix on chipnet", () => {
      const svc = WalletManagerService({
        appDb: makeMockDb({}),
        network: "chipnet",
      });
      const stub = {
        mnemonic:
          "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        passphrase: "",
        derivation: "m/44'/145'/0'" as const,
      };
      const wallet = svc.createTemporaryWallet(stub);
      expect(wallet.prefix).toBe("bchtest");
      expect(wallet.network).toBe("chipnet");
    });
  });

  // ── getWalletMeta: guard clauses ───────────────────────────────────
  describe("getWalletMeta", () => {
    it("throws WalletNotExistsError for empty walletHash", () => {
      const svc = WalletManagerService({
        appDb: makeMockDb({}),
        network: "mainnet",
      });
      expect(() => svc.getWalletMeta("")).toThrow(WalletNotExistsError);
    });

    it("throws WalletNotExistsError when no rows returned", () => {
      const svc = WalletManagerService({
        appDb: makeMockDb({ exec: vi.fn(() => []) }),
        network: "mainnet",
      });
      expect(() => svc.getWalletMeta("nonexistent")).toThrow(
        WalletNotExistsError
      );
    });
  });
});

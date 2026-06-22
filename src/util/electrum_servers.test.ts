import { describe, it, expect } from "vitest";
import {
  ElectrumServer,
  DEFAULT_ELECTRUM_PORT,
  getTxExplorerUrl,
} from "./network";

describe("electrum_servers.ts", () => {
  describe("ElectrumServer", () => {
    it("parses host:port string", () => {
      const server = new ElectrumServer("example.com:50004");
      expect(server.toParts()).toEqual({ host: "example.com", port: 50004 });
      expect(server.toString()).toBe("example.com:50004");
    });

    it("uses default port when only host provided", () => {
      const server = new ElectrumServer("example.com");
      expect(server.toParts()).toEqual({
        host: "example.com",
        port: DEFAULT_ELECTRUM_PORT,
      });
    });

    it("accepts explicit port parameter", () => {
      const server = new ElectrumServer("example.com", 12345);
      expect(server.toParts()).toEqual({ host: "example.com", port: 12345 });
    });

    it("host:port string overrides explicit port", () => {
      const server = new ElectrumServer("example.com:50004", 99999);
      expect(server.toParts().port).toBe(50004);
    });

    it("handles non-standard ports", () => {
      const server = new ElectrumServer("chipnet.c3-soft.com:64004");
      expect(server.toParts()).toEqual({
        host: "chipnet.c3-soft.com",
        port: 64004,
      });
    });

    it("toString round-trips with constructor", () => {
      const original = "bch.loping.net:50004";
      const server = new ElectrumServer(original);
      expect(server.toString()).toBe(original);
    });
  });

  describe("ElectrumServer.toParts (static)", () => {
    it("parses host:port", () => {
      expect(ElectrumServer.toParts("example.com:50004")).toEqual({
        host: "example.com",
        port: 50004,
      });
    });

    it("defaults port for host-only string", () => {
      expect(ElectrumServer.toParts("example.com")).toEqual({
        host: "example.com",
        port: DEFAULT_ELECTRUM_PORT,
      });
    });

    it("defaults to empty host and default port for empty string", () => {
      expect(ElectrumServer.toParts("")).toEqual({
        host: "",
        port: DEFAULT_ELECTRUM_PORT,
      });
    });

    it("defaults to empty host and default port for undefined", () => {
      expect(ElectrumServer.toParts()).toEqual({
        host: "",
        port: DEFAULT_ELECTRUM_PORT,
      });
    });
  });

  describe("getTxExplorerUrl", () => {
    const txid =
      "abc123def456abc123def456abc123def456abc123def456abc123def456abcd";

    it("returns mainnet explorer URL", () => {
      expect(getTxExplorerUrl(txid, "mainnet")).toBe(
        `https://bchexplorer.cash/tx/${txid}`
      );
    });

    it("returns chipnet explorer URL", () => {
      expect(getTxExplorerUrl(txid, "chipnet")).toBe(
        `https://chipnet.bch.ninja/tx/${txid}`
      );
    });

    it("returns testnet3 explorer URL", () => {
      expect(getTxExplorerUrl(txid, "testnet3")).toBe(
        `https://tbch.loping.net/tx/${txid}`
      );
    });

    it("returns testnet4 explorer URL", () => {
      expect(getTxExplorerUrl(txid, "testnet4")).toBe(
        `https://tbch4.loping.net/tx/${txid}`
      );
    });

    it("falls back to mainnet for unknown network", () => {
      expect(getTxExplorerUrl(txid, "unknown" as any)).toBe(
        `https://bchexplorer.cash/tx/${txid}`
      );
    });
  });

  describe("DEFAULT_ELECTRUM_PORT", () => {
    it("is 50004", () => {
      expect(DEFAULT_ELECTRUM_PORT).toBe(50004);
    });
  });
});

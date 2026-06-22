import { describe, it, expect, vi, beforeEach } from "vitest";
import { Filesystem } from "@capacitor/filesystem";

vi.unmock("@/kernel/app/JanitorService");

// Mock Capacitor.isNativePlatform() — fsck branches on this
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
}));

import JanitorService from "./JanitorService";

describe("JanitorService", () => {
  // ── fsck: directory bootstrapping ──────────────────────────────────
  describe("fsck", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("creates directories with recursive:true on fresh install", async () => {
      // Fresh install: all readdir calls fail (no directories exist)
      vi.mocked(Filesystem.readdir).mockRejectedValue(
        new Error("Directory does not exist")
      );
      vi.mocked(Filesystem.mkdir).mockResolvedValue({ uri: "" });

      const janitor = JanitorService();
      await janitor.fsck();

      // Every mkdir call must include recursive:true
      const mkdirCalls = vi.mocked(Filesystem.mkdir).mock.calls;
      expect(mkdirCalls.length).toBeGreaterThan(0);
      mkdirCalls.forEach(([opts]) => {
        expect(opts).toHaveProperty("recursive", true);
      });
    });

    it("survives when directories already exist", async () => {
      // Existing install: mkdir throws "already exists"
      vi.mocked(Filesystem.mkdir).mockRejectedValue(
        new Error("Directory already exists")
      );

      const janitor = JanitorService();
      await expect(janitor.fsck()).resolves.not.toThrow();
    });
  });
});

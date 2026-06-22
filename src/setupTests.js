/**
 * Vitest setup file - runs before each test file
 *
 * This is where we set up:
 * - Global test utilities
 * - Mock implementations for browser/native APIs
 * - Extended matchers
 */
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock WalletManagerService for tests that use validateBip21Uri
// This is needed because validateBip21Uri calls WalletManagerService().getPrefix()
vi.mock("@/kernel/wallet/WalletManagerService", () => ({
  default: () => ({
    getPrefix: () => "bitcoincash",
    getNetwork: () => "mainnet",
  }),
}));

// Mock Capacitor plugins that don't exist in Node environment
vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
    vibrate: vi.fn(),
  },
}));

vi.mock("@capacitor/clipboard", () => ({
  Clipboard: {
    write: vi.fn(),
    read: vi.fn(),
  },
}));

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  },
  Directory: {
    Data: "DATA",
    Documents: "DOCUMENTS",
    Cache: "CACHE",
  },
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    keys: vi.fn(),
    clear: vi.fn(),
  },
}));

// Mock haptic utility
vi.mock("@/util/haptic", () => ({
  Haptic: {
    success: vi.fn(),
    error: vi.fn(),
    light: vi.fn(),
    medium: vi.fn(),
    heavy: vi.fn(),
  },
}));

// Mock sql.js to avoid WASM loading issues in tests
vi.mock("sql.js", () => ({
  default: vi.fn(() =>
    Promise.resolve({
      Database: vi.fn(() => ({
        run: vi.fn(),
        exec: vi.fn(() => []),
        prepare: vi.fn(() => ({
          bind: vi.fn(),
          step: vi.fn(),
          getAsObject: vi.fn(),
          free: vi.fn(),
        })),
        close: vi.fn(),
      })),
    })
  ),
}));

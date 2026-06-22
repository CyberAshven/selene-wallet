import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "html" : "list",
  timeout: 60_000,

  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 390, height: 844 },
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["iPhone 14"],
        defaultBrowserType: "chromium",
      },
      testIgnore: /screenshots\.spec/,
    },
    {
      name: "screenshots",
      testMatch: /screenshots\.spec/,
      use: {
        browserName: "chromium",
        // 360x800 @ 4x = 1440x3200 (Google Play phone screenshot size)
        // Viewport must be under 480px to avoid web viewport constraint
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 4,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  webServer: {
    command: "pnpm preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

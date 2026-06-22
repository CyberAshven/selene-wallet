/// <reference types="vitest" />
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import topLevelAwait from "vite-plugin-top-level-await";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    visualizer(),
    react(),
    nodePolyfills({
      include: ["fs", "path"], // sql.js needs fs/path stubs only
    }),
    topLevelAwait({
      promiseExportName: "__tla",
      promiseImportName: (i) => `__tla_${i}`,
    }),
  ],
  build: {
    target: ["es2020", "chrome87", "safari14", "firefox78", "edge88"],
  },
  resolve: {
    alias: {
      "@/composite": path.resolve(__dirname, "./src/components/composite"),
      "@/layout": path.resolve(__dirname, "./src/components/layout"),
      "@/views": path.resolve(__dirname, "./src/components/views"),
      "@/atoms": path.resolve(__dirname, "./src/components/atoms"),
      "@/icons": path.resolve(__dirname, "./src/components/atoms/icons"),
      "@/apps": path.resolve(__dirname, "./src/components/views/apps"),
      "@": path.resolve(__dirname, "./src"),
      // Dedupe @capacitor/core for linked plugins
      "@capacitor/core": path.resolve(__dirname, "./node_modules/@capacitor/core"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./src/setupTests.js",
    exclude: ["e2e/**", "node_modules/**"],
  },
});

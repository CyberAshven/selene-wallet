import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import originalConfig from "./vite.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// On Windows, public/sql-wasm.wasm is a broken symlink from the Linux repo.
// Copy the real WASM from node_modules if the public copy is a stub (< 1 KB).
const wasmPublic = path.resolve(__dirname, "public/sql-wasm.wasm");
const wasmSource = path.resolve(__dirname, "node_modules/sql.js/dist/sql-wasm.wasm");
if (fs.existsSync(wasmSource) && (!fs.existsSync(wasmPublic) || fs.statSync(wasmPublic).size < 1024)) {
  fs.copyFileSync(wasmSource, wasmPublic);
}

// Capacitor uses window.CapacitorCustomPlatform to detect third-party platforms.
// Injecting this before any JS loads makes isNativePlatform() return true and
// getPlatform() return "desktop" — using Capacitor's own intended extension point.
const capacitorPlatformPlugin = {
  name: "tauri-capacitor-platform",
  transformIndexHtml(html) {
    return html.replace(
      "<head>",
      `<head><script>window.CapacitorCustomPlatform={name:"desktop"};</script>`
    );
  },
};

export default {
  ...originalConfig,
  plugins: [
    ...(originalConfig.plugins ?? []),
    capacitorPlatformPlugin,
  ],
  resolve: {
    ...originalConfig.resolve,
    alias: {
      ...originalConfig.resolve.alias,
      "@capacitor-community/screen-brightness": path.resolve(
        __dirname,
        "src/platform/desktop/screen-brightness.ts"
      ),
      "@capacitor/app": path.resolve(
        __dirname,
        "src/platform/desktop/app.ts"
      ),
      "@capacitor/filesystem": path.resolve(
        __dirname,
        "src/platform/desktop/filesystem.ts"
      ),
      "@capacitor/device": path.resolve(
        __dirname,
        "src/platform/desktop/device.ts"
      ),
      "capacitor-plugin-simple-encryption": path.resolve(
        __dirname,
        "src/platform/desktop/encryption.ts"
      ),
    },
  },
};

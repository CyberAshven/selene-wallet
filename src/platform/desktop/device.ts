// Shim for @capacitor/device in the Tauri desktop wrapper.
// Device.getInfo() returns platform: "web" in any WebView without a native bridge.
// We return real OS info so the app correctly identifies itself as native desktop.
// Uses navigator.userAgent — available in all WebViews (WebView2, WebKit, WebKitGTK).

type OperatingSystem = "ios" | "android" | "windows" | "mac" | "unknown";

interface DeviceId {
  identifier: string;
}

interface DeviceInfo {
  model: string;
  platform: string;
  operatingSystem: OperatingSystem;
  osVersion: string;
  manufacturer: string;
  isVirtual: boolean;
  webViewVersion?: string;
}

interface LanguageTag {
  value: string;
}

function detectOS(): { operatingSystem: OperatingSystem; manufacturer: string; model: string } {
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) {
    const match = ua.match(/Windows NT ([\d.]+)/);
    return { operatingSystem: "windows", manufacturer: "Microsoft", model: match ? `Windows ${match[1]}` : "Windows" };
  }
  if (ua.includes("Macintosh") || ua.includes("Mac OS X")) {
    return { operatingSystem: "mac", manufacturer: "Apple", model: "Mac" };
  }
  return { operatingSystem: "unknown", manufacturer: "Unknown", model: "Linux Desktop" };
}

function getOrCreateDeviceId(): string {
  const key = "selene-desktop-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export const Device = {
  getId(): Promise<DeviceId> {
    return Promise.resolve({ identifier: getOrCreateDeviceId() });
  },

  getInfo(): Promise<DeviceInfo> {
    const { operatingSystem, manufacturer, model } = detectOS();
    return Promise.resolve({
      model,
      platform: "desktop",
      operatingSystem,
      osVersion: navigator.userAgent,
      manufacturer,
      isVirtual: false,
    });
  },

  getLanguageTag(): Promise<LanguageTag> {
    return Promise.resolve({ value: navigator.language || "en-US" });
  },

  getBatteryInfo(): Promise<{ batteryLevel: number; isCharging: boolean }> {
    return Promise.resolve({ batteryLevel: 1.0, isCharging: true });
  },
};

export type { DeviceId, DeviceInfo, LanguageTag };

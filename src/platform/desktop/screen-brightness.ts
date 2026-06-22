// No-op shim — @capacitor-community/screen-brightness has no web implementation
// (registerPlugin('ScreenBrightness', {}) with empty factory). Desktop can't
// control screen brightness; we silently return full brightness and ignore sets.
export const ScreenBrightness = {
  getBrightness: async (): Promise<{ brightness: number }> => ({ brightness: 1.0 }),
  setBrightness: async (_options: { brightness: number }): Promise<void> => {},
};

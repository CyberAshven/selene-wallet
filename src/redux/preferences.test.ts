/**
 * Tests for validatePreferences
 *
 * This function exists because of issue #92 - when VEF was removed from
 * currencyList, users with VEF in stored preferences experienced unrecoverable
 * crashes. validatePreferences guards against stale preferences from old
 * app versions that reference removed options.
 *
 * The recovery path: if validation fails, preferences are cleared and reset
 * to defaults. These tests ensure the guard catches bad state.
 */

import { describe, it, expect } from "vitest";
import {
  validatePreferences,
  defaultPreferences,
  ValidPreferences,
} from "./preferences";
import { currencyList } from "@/util/currency";
import { languageList } from "@/util/translations";
import { VALID_DENOMINATIONS } from "@/util/sats";

const makePrefs = (overrides: Partial<ValidPreferences>): ValidPreferences => ({
  ...defaultPreferences,
  ...overrides,
});

describe("validatePreferences", () => {
  // Sanity check - defaults should always be valid
  it("accepts default preferences", () => {
    expect(validatePreferences(defaultPreferences)).toBe(true);
  });

  // test for #92, the issue that prompted creation of validatePreferences
  describe("stale currency codes", () => {
    it("rejects any currency not in currencyList", () => {
      expect(
        validatePreferences(makePrefs({ localCurrency: "REMOVED_CURRENCY" }))
      ).toBe(false);
    });

    it("accepts all currencies currently in currencyList", () => {
      currencyList.forEach((c) => {
        expect(
          validatePreferences(makePrefs({ localCurrency: c.currency })),
          `${c.currency} should be valid`
        ).toBe(true);
      });
    });
  });

  describe("stale language codes", () => {
    it("rejects language code not in languageList", () => {
      expect(validatePreferences(makePrefs({ languageCode: "xx" }))).toBe(
        false
      );
    });

    it("accepts all languages currently in languageList", () => {
      languageList.forEach((lang) => {
        expect(
          validatePreferences(makePrefs({ languageCode: lang.code })),
          `${lang.code} should be valid`
        ).toBe(true);
      });
    });
  });

  describe("stale denomination", () => {
    it("rejects denomination not in VALID_DENOMINATIONS", () => {
      expect(validatePreferences(makePrefs({ denomination: "btc" }))).toBe(
        false
      );
    });

    it("accepts all valid denominations", () => {
      VALID_DENOMINATIONS.forEach((denom) => {
        expect(
          validatePreferences(makePrefs({ denomination: denom.toLowerCase() })),
          `${denom} should be valid`
        ).toBe(true);
      });
    });
  });

  describe("auth actions (encryption MR additions)", () => {
    it("accepts AppOpen and AppResume auth actions", () => {
      expect(
        validatePreferences(
          makePrefs({
            authActions: "Any;AppOpen;AppResume;SendTransaction",
          })
        )
      ).toBe(true);
    });

    it("accepts all AuthActions values individually", () => {
      const allActions = [
        "Any",
        "Debug",
        "AppOpen",
        "AppResume",
        "WalletActivate",
        "SendTransaction",
        "InstantPay",
        "RevealBalance",
        "RevealPrivateKeys",
        "VendorMode",
      ];
      allActions.forEach((action) => {
        expect(
          validatePreferences(makePrefs({ authActions: action })),
          `${action} should be a valid auth action`
        ).toBe(true);
      });
    });
  });

  describe("pinInputMode validation", () => {
    it("rejects corrupted pinInputMode", () => {
      expect(
        validatePreferences(
          makePrefs({ pinInputMode: "numeric" as "true" | "false" })
        )
      ).toBe(false);
    });

    it("accepts valid pinInputMode values", () => {
      expect(validatePreferences(makePrefs({ pinInputMode: "true" }))).toBe(
        true
      );
      expect(validatePreferences(makePrefs({ pinInputMode: "false" }))).toBe(
        true
      );
    });
  });

  describe("encryption preference keys", () => {
    it("rejects corrupted encryptionDeviceOnly", () => {
      expect(
        validatePreferences(
          makePrefs({ encryptionDeviceOnly: "yes" as "true" | "false" })
        )
      ).toBe(false);
    });

    it("rejects corrupted useLegacyBip21", () => {
      expect(
        validatePreferences(
          makePrefs({ useLegacyBip21: "1" as "true" | "false" })
        )
      ).toBe(false);
    });

    it("accepts valid encryption boolean values", () => {
      expect(
        validatePreferences(
          makePrefs({
            encryptionDeviceOnly: "true",
            useLegacyBip21: "false",
          })
        )
      ).toBe(true);
    });
  });

  describe("corrupted data from storage", () => {
    // These test what happens when Capacitor Preferences returns garbage

    it("rejects non-numeric lastExchangeRate", () => {
      expect(
        validatePreferences(makePrefs({ lastExchangeRate: "corrupted" }))
      ).toBe(false);
    });

    it("rejects empty lastExchangeRate", () => {
      expect(validatePreferences(makePrefs({ lastExchangeRate: "" }))).toBe(
        false
      );
    });

    it("rejects invalid boolean strings", () => {
      expect(
        validatePreferences(
          makePrefs({ preferLocalCurrency: "yes" as "true" | "false" })
        )
      ).toBe(false);
    });

    it("rejects empty string for boolean field", () => {
      expect(
        validatePreferences(makePrefs({ offlineMode: "" as "true" | "false" }))
      ).toBe(false);
    });

    it("rejects invalid authActions", () => {
      expect(
        validatePreferences(makePrefs({ authActions: "MadeUpAction" }))
      ).toBe(false);
    });
  });

  describe("type coercion edge cases", () => {
    // What if wrong types sneak through at runtime?

    it("handles number passed as lastExchangeRate", () => {
      // parseFloat(1) works, so this actually passes
      const prefs = makePrefs({});
      (prefs as Record<string, unknown>).lastExchangeRate = 1;
      expect(validatePreferences(prefs)).toBe(true);
    });

    it("rejects null lastExchangeRate", () => {
      const prefs = makePrefs({});
      (prefs as Record<string, unknown>).lastExchangeRate = null;
      expect(validatePreferences(prefs)).toBe(false);
    });

    it("rejects boolean instead of boolean string", () => {
      const prefs = makePrefs({});
      (prefs as Record<string, unknown>).offlineMode = true;
      expect(validatePreferences(prefs)).toBe(false);
    });
  });
});

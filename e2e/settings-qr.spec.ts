import { test, expect } from "./helpers/fixtures";
import { nav } from "./helpers/selectors";
import { accordionControl } from "./helpers/wallet";

test.describe("Settings: QR Code", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const qrBtn = page.getByRole("button", { name: "QR Code" });
    await expect(qrBtn).toBeVisible();
    await qrBtn.click();
  });

  test("QR logo select changes logo", async ({ appPage: page }) => {
    const logoSelect = accordionControl(page, "Logo", "select");
    await expect(logoSelect).toBeVisible({ timeout: 3_000 });

    const count = await logoSelect.getByRole("option").count();
    expect(count).toBeGreaterThanOrEqual(2);

    const originalValue = await logoSelect.inputValue();
    await logoSelect.selectOption({ index: 1 });
    await expect(logoSelect).not.toHaveValue(originalValue);
  });

  test("foreground color input works", async ({ appPage: page }) => {
    const colorInput = accordionControl(
      page,
      "Foreground color",
      "input[type='color']"
    );
    await expect(colorInput).toBeVisible({ timeout: 3_000 });

    const value = await colorInput.inputValue();
    expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test("background color input works", async ({ appPage: page }) => {
    const colorInput = accordionControl(
      page,
      "Background color",
      "input[type='color']"
    );
    await expect(colorInput).toBeVisible({ timeout: 3_000 });

    const value = await colorInput.inputValue();
    expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test("reset colors restores defaults", async ({ appPage: page }) => {
    const resetBtn = page.getByRole("button", { name: /reset/i });
    await resetBtn.scrollIntoViewIfNeeded();
    await expect(resetBtn).toBeVisible({ timeout: 3_000 });
    await resetBtn.click();

    const fgInput = accordionControl(
      page,
      "Foreground color",
      "input[type='color']"
    );
    const bgInput = accordionControl(
      page,
      "Background color",
      "input[type='color']"
    );

    await expect(fgInput).toHaveValue("#000000");
    await expect(bgInput).toHaveValue("#ffffff");
  });
});

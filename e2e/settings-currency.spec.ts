import { test, expect } from "./helpers/fixtures";
import { nav, walletView } from "./helpers/selectors";
import { accordionControl, expectToggle } from "./helpers/wallet";

test.describe("Settings: Currency", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const currencyBtn = page.getByRole("button", { name: "Currency" });
    await expect(currencyBtn).toBeVisible();
    await currencyBtn.click();
  });

  test("denomination select changes between BCH and sats", async ({
    appPage: page,
  }) => {
    const denomSelect = accordionControl(page, "Denomination", "select");
    await expect(denomSelect).toBeVisible({ timeout: 3_000 });

    const options = denomSelect.getByRole("option");
    const optionTexts = await options.allTextContents();
    expect(optionTexts.some((t) => /bch/i.test(t))).toBe(true);
    expect(optionTexts.some((t) => /sat/i.test(t))).toBe(true);

    // Switch to sats
    const satsLabel = optionTexts.find((t) => /sat/i.test(t))!;
    await denomSelect.selectOption({ label: satsLabel });

    // Verify balance area is still functional
    await nav.wallet(page).click();
    await expect(walletView.balanceArea(page)).toBeVisible();

    // Restore to BCH
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");
    await page.getByRole("button", { name: "Currency" }).click();
    const denomSelect2 = accordionControl(page, "Denomination", "select");
    const bchLabel = optionTexts.find((t) => /bch/i.test(t))!;
    await denomSelect2.selectOption({ label: bchLabel });
  });

  test("local currency select changes fiat currency", async ({
    appPage: page,
  }) => {
    const currencySelect = accordionControl(
      page,
      "Local currency",
      "select"
    ).first();
    await expect(currencySelect).toBeVisible({ timeout: 3_000 });

    const options = currencySelect.getByRole("option");
    await expect(options).toHaveCount(
      await options.count()
    );
    const count = await options.count();
    expect(count).toBeGreaterThan(10);

    await currencySelect.selectOption({ value: "EUR" });
    await expect(currencySelect).toHaveValue("EUR");

    // Restore USD
    await currencySelect.selectOption({ value: "USD" });
  });

  test("prefer local currency toggle works", async ({ appPage: page }) => {
    const checkbox = accordionControl(
      page,
      "Prefer local currency",
      "input[type='checkbox']"
    );
    await expect(checkbox).toBeVisible({ timeout: 3_000 });

    await expectToggle(checkbox);
  });
});

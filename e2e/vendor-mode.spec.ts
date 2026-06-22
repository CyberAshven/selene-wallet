import { test, expect } from "./helpers/fixtures";

test.describe("Vendor Mode", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.goto("/vendor");
    await expect(
      page.getByRole("button", { name: "1", exact: true }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("vendor mode page renders with QR and numpad", async ({
    appPage: page,
  }) => {
    await expect(page.getByRole("img").first()).toBeVisible();

    // Numpad grid buttons (digits 0-9, C for clear, . for decimal)
    const buttons = ["1", "5", "9", "0", "C", "."];
    await Promise.all(
      buttons.map((digit) =>
        expect(
          page.getByRole("button", { name: digit, exact: true }).first()
        ).toBeVisible()
      )
    );
  });

  test("numpad enters digits and updates display", async ({
    appPage: page,
  }) => {
    const amountDisplay = page.getByTestId("vendor-amount");

    // Type "42" via numpad buttons
    await page.getByRole("button", { name: "4", exact: true }).first().click();
    await page.getByRole("button", { name: "2", exact: true }).first().click();

    // The amount display should reflect the entered value
    await expect(amountDisplay).toContainText("42");
  });

  test("clear button resets amount", async ({ appPage: page }) => {
    const amountDisplay = page.getByTestId("vendor-amount");

    // Enter some digits — "78" chosen to avoid matching numpad button labels
    await page.getByRole("button", { name: "7", exact: true }).first().click();
    await page.getByRole("button", { name: "8", exact: true }).first().click();
    await expect(amountDisplay).toContainText("78");

    // Click "C" to clear
    await page.getByRole("button", { name: "C", exact: true }).click();

    // The display should reset to zero
    await expect(amountDisplay).not.toContainText("78");
  });

  test("exit button is visible", async ({ appPage: page }) => {
    const exitButton = page.getByRole("img", { name: "close" });
    await expect(exitButton).toBeVisible({ timeout: 3_000 });
  });
});

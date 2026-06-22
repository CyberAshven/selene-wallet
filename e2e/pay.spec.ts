import { test, expect } from "./helpers/fixtures";

test.describe("Pay (Invoice)", () => {
  test("pay page renders with request URL", async ({ appPage: page }) => {
    await page.goto("/wallet/pay?r=https://example.com/invoice");

    const paymentHeader = page.getByText("Payment To", { exact: false });
    const errorHeader = page.getByText("Invalid", { exact: false });
    await expect(paymentHeader.or(errorHeader).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test.fixme("instant pay works if enabled", async () => {
    // Requires instant pay to be enabled and a valid invoice below threshold
  });

  test.fixme("send works on pay page", async () => {
    // Requires a valid invoice and sufficient funds
  });
});

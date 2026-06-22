import { test, expect } from "./helpers/fixtures";
import { sweepPage } from "./helpers/selectors";

test.describe("Sweep", () => {
  test("sweep page renders with WIF param", async ({ appPage: page }) => {
    await page.goto(
      "/wallet/sweep/5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ"
    );

    const sweepHeader = page.getByText("Sweeping From", { exact: false });
    const errorBanner = sweepPage.error(page);
    await expect(sweepHeader.or(errorBanner).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test.fixme("instant sweep respects threshold", async () => {
    // Requires instant pay enabled + a WIF key with balance below threshold
  });

  test.fixme("sweep sends funds to wallet", async () => {
    // Requires a funded WIF key; would consume funds on each run
  });
});

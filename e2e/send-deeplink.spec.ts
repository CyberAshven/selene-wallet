import { test, expect } from "./helpers/fixtures";
import { sendPage } from "./helpers/selectors";

test.describe("Send Deep Link", () => {
  test("deep-link to send page with address", async ({ appPage: page }) => {
    await page.goto(
      "/wallet/send/qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a"
    );

    await expect(sendPage.header(page)).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Sending to", { exact: false })
    ).toBeVisible();
  });

  test("deep-link to send page without address", async ({
    appPage: page,
  }) => {
    await page.goto("/wallet/send/");

    await expect(sendPage.header(page)).toBeVisible({ timeout: 10_000 });
    await expect(sendPage.addressInput(page)).toBeVisible();
    await expect(sendPage.amountInput(page).first()).toBeVisible();
  });
});

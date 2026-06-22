import { test, expect } from "./helpers/fixtures";
import { walletView, historyPage } from "./helpers/selectors";

test.describe("History", () => {
  test.beforeEach(async ({ appPage: page }) => {
    const historyBtn = walletView.historyButton(page);
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();
    await page.waitForURL("**/wallet/history**");
  });

  test("history page renders", async ({ appPage: page }) => {
    await expect(historyPage.container(page)).toBeVisible();
  });

  test("shows Recent Transactions header", async ({ appPage: page }) => {
    await expect(
      page.getByText("Recent Transactions", { exact: false })
    ).toBeVisible();
  });

  test("search input is visible and accepts text", async ({
    appPage: page,
  }) => {
    const searchInput = page.getByPlaceholder("Search");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("test query");
    await expect(searchInput).toHaveValue("test query");

    // Clear button should appear when search has text
    const clearBtn = page.getByRole("img", { name: "close-circle" });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(searchInput).toHaveValue("");
  });

  test("filter panel toggles open and closed", async ({ appPage: page }) => {
    const filterBtn = page
      .getByRole("button")
      .filter({ has: page.getByRole("img", { name: "filter" }) });
    await expect(filterBtn).toBeVisible();

    const sortByLabel = page.getByText("Sort By", { exact: false });
    await expect(sortByLabel).toBeHidden();

    await filterBtn.click();
    await expect(sortByLabel).toBeVisible();

    await filterBtn.click();
    await expect(sortByLabel).toBeHidden();
  });

  test("filter panel has sort controls", async ({ appPage: page }) => {
    const filterBtn = page
      .getByRole("button")
      .filter({ has: page.getByRole("img", { name: "filter" }) });
    await filterBtn.click();

    const sortSelect = page.getByRole("combobox").first();
    await expect(sortSelect).toBeVisible();
    await expect(sortSelect.getByRole("option")).toHaveCount(3);

    // Sort direction toggle button
    const sortDirBtn = page
      .getByRole("button")
      .filter({
        has: page.getByRole("img", {
          name: /sort-ascending|sort-descending/,
        }),
      });
    await expect(sortDirBtn).toBeVisible();
    await sortDirBtn.click();
    await expect(sortDirBtn).toBeVisible();
  });

  test("filter panel has direction radio buttons", async ({
    appPage: page,
  }) => {
    const filterBtn = page
      .getByRole("button")
      .filter({ has: page.getByRole("img", { name: "filter" }) });
    await filterBtn.click();

    await expect(
      page.getByText("Direction", { exact: true })
    ).toBeVisible();

    await expect(page.getByText("Incoming")).toBeVisible();
    await expect(page.getByText("Outgoing")).toBeVisible();

    // Click "Incoming" label to select that radio
    await page.getByText("Incoming").click();
    await page.getByText("Outgoing").click();
  });

  test("filter panel has token and NFT filters", async ({
    appPage: page,
  }) => {
    const filterBtn = page
      .getByRole("button")
      .filter({ has: page.getByRole("img", { name: "filter" }) });
    await filterBtn.click();

    await expect(page.getByText("Tokens", { exact: true })).toBeVisible();
    await expect(page.getByText("Has Tokens")).toBeVisible();
    await expect(page.getByText("No Tokens")).toBeVisible();

    await expect(page.getByText("NFTs", { exact: true })).toBeVisible();
    await expect(page.getByText("Has NFTs")).toBeVisible();
    await expect(page.getByText("No NFTs")).toBeVisible();
  });

  test("reset filters button clears selections", async ({
    appPage: page,
  }) => {
    const filterBtn = page
      .getByRole("button")
      .filter({ has: page.getByRole("img", { name: "filter" }) });
    await filterBtn.click();

    // Change a filter (select "Incoming")
    await page.getByText("Incoming").click();

    // Click reset
    const resetBtn = page.getByText("Reset Filters", { exact: true });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
  });

  test("empty wallet shows empty state", async ({ appPage: page }) => {
    const emptyMarker = page.getByText("-----");
    const syncIndicator = page.getByTestId("sync-indicator");

    await expect(emptyMarker.or(syncIndicator).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("search with no results shows feedback", async ({
    appPage: page,
  }) => {
    const searchInput = page.getByPlaceholder("Search");
    await searchInput.fill("zzzznonexistenttxid");

    const noResults = page.getByText("no results", { exact: false });
    const emptyMarker = page.getByText("-----");

    await expect(noResults.or(emptyMarker).first()).toBeVisible({
      timeout: 3_000,
    });
  });

  test.fixme(
    "export CSV button visible when experimental enabled",
    async () => {
      // Requires navigating to /debug, enabling experimental, then history
    }
  );

  test.fixme(
    "infinite scroll loads more transactions",
    async () => {
      // Requires a wallet with enough transactions to trigger pagination
    }
  );
});

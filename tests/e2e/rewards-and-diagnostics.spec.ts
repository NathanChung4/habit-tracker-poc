import { expect, test, type Page } from "@playwright/test";

const e2eEmail = process.env.E2E_EMAIL;
const e2ePassword = process.env.E2E_PASSWORD;
const hasCredentials = Boolean(e2eEmail && e2ePassword);

async function signIn(page: Page) {
  await page.goto("/login");

  if (new URL(page.url()).pathname === "/today") {
    return;
  }

  await expect(page.getByRole("heading", { name: "Build Momentum Daily" })).toBeVisible();
  await page.getByLabel("Email").fill(e2eEmail!);
  await page.getByLabel("Password").fill(e2ePassword!);

  await Promise.all([page.waitForURL("**/today"), page.getByRole("button", { name: "Sign in" }).click()]);
}

test.describe("authenticated rewards and diagnostics flows", () => {
  test.skip(!hasCredentials, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated e2e flows.");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("reward contract unlocks and can be redeemed", async ({ page }) => {
    const rewardTitle = `E2E Reward ${Date.now()}`;

    await page.goto("/rewards");
    await expect(page.getByRole("heading", { name: "Rewards" })).toBeVisible();

    await page.getByLabel("Reward title").fill(rewardTitle);
    await page.getByLabel("Unlock threshold (0-1)").first().fill("0");
    await page.getByRole("button", { name: "Create contract" }).click();

    const rewardsContractRow = page.locator(".contract-list li", { hasText: rewardTitle }).first();
    await expect(rewardsContractRow).toContainText("0% threshold");

    await page.goto("/today");
    const unlocksSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Today's Reward Unlocks" })
    });
    const todayUnlockRow = unlocksSection.locator("li", { hasText: rewardTitle }).first();

    await expect(todayUnlockRow).toContainText("Needs 0% completion");
    await todayUnlockRow.getByRole("button", { name: "Redeem" }).click();
    await expect(todayUnlockRow.locator(".tag.status-redeemed")).toBeVisible();

    const redemptionsSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Recent Redemptions" })
    });
    await expect(redemptionsSection.locator("li", { hasText: rewardTitle }).first()).toBeVisible();

    await page.goto("/rewards");
    const cleanupRow = page.locator(".contract-list li", { hasText: rewardTitle }).first();
    if ((await cleanupRow.count()) > 0) {
      await cleanupRow.getByRole("button", { name: "Delete" }).click();
      await expect(page.locator(".contract-list li", { hasText: rewardTitle })).toHaveCount(0);
    }
  });

  test("diagnostics settings persist after refresh", async ({ page }) => {
    await page.goto("/reports/decisions");
    await expect(page.getByRole("heading", { name: "Decision Reports" })).toBeVisible();

    const tokenWindowInput = page.getByLabel("Token window (days)");
    const tokenThresholdInput = page.getByLabel("Token threshold");
    const rewardWindowInput = page.getByLabel("Reward window (days)");
    const streakWindowInput = page.getByLabel("Streak eval window (days)");

    const originalValues = {
      tokenWindowDays: await tokenWindowInput.inputValue(),
      tokenUsageThreshold: await tokenThresholdInput.inputValue(),
      rewardWindowDays: await rewardWindowInput.inputValue(),
      streakEvalWindowDays: await streakWindowInput.inputValue()
    };

    await tokenWindowInput.fill("11");
    await tokenThresholdInput.fill("4");
    await rewardWindowInput.fill("19");
    await streakWindowInput.fill("5");
    await page.getByRole("button", { name: "Save diagnostics settings" }).click();
    await expect(page.getByText("Diagnostics settings saved.")).toBeVisible();

    await page.reload();

    await expect(tokenWindowInput).toHaveValue("11");
    await expect(tokenThresholdInput).toHaveValue("4");
    await expect(rewardWindowInput).toHaveValue("19");
    await expect(streakWindowInput).toHaveValue("5");

    await tokenWindowInput.fill(originalValues.tokenWindowDays);
    await tokenThresholdInput.fill(originalValues.tokenUsageThreshold);
    await rewardWindowInput.fill(originalValues.rewardWindowDays);
    await streakWindowInput.fill(originalValues.streakEvalWindowDays);
    await page.getByRole("button", { name: "Save diagnostics settings" }).click();
    await expect(page.getByText("Diagnostics settings saved.")).toBeVisible();
  });
});

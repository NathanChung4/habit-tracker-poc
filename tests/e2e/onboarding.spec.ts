import { expect, test } from "@playwright/test";

test.describe("onboarding and daily flow", () => {
  test("shows login screen", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Build Momentum Daily" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("renders habits page when authenticated", async ({ page }) => {
    test.skip(true, "Requires authenticated fixture and Supabase test project");

    await page.goto("/habits");
    await expect(page.getByRole("heading", { name: "Habits" })).toBeVisible();
  });
});

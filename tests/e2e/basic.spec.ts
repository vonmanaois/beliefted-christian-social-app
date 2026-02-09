import { test, expect } from "@playwright/test";

test.describe("Lifted basic navigation", () => {
  test("home loads and shows tabs", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Faith Share" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Prayer Wall" })).toBeVisible();

    await page.getByRole("button", { name: "Prayer Wall" }).click();
    await expect(page).toHaveURL(/\/prayerwall$/);
  });

  test("faith share composer prompt shows", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/Share your faith|Sign in to post a word/)).toBeVisible();
  });

  test("search page renders", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
  });
});

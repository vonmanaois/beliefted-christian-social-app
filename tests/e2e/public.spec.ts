import { test, expect } from "@playwright/test";

test.describe("Public pages and unauth flows", () => {
  test("why-beliefted page renders", async ({ page }) => {
    await page.goto("/why-beliefted");
    await expect(page.getByRole("heading", { name: "Why Beliefted" })).toBeVisible();
  });

  test("terms and privacy pages render", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });

  test("search page prompts for minimum characters", async ({ page }) => {
    await page.goto("/search");
    const input = page.getByPlaceholder("Search people...").first();
    await expect(input).toBeVisible();
    await input.fill("a");
    await expect(page.getByText("Type at least 2 characters to search.")).toBeVisible();
  });

  test("notifications page shows sign-in prompt for unauth users", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByText("Sign in to see notifications.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" })
    ).toBeVisible();
  });

  test("profile redirects to home when unauthenticated", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/$/);
  });

  test("word alias redirects to word of the day", async ({ page }) => {
    await page.goto("/word");
    await expect(page).toHaveURL(/\/wordoftheday$/);
  });

  test("word composer opens sign-in modal when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Sign in to post a word").click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("prayer composer opens sign-in modal when unauthenticated", async ({ page }) => {
    await page.goto("/prayerwall");
    await page.getByText("Sign in to post a prayer").click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});

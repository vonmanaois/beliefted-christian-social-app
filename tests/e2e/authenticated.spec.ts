import { test, expect } from "@playwright/test";
import { loginAs, resetE2E, goToProfile } from "./utils/e2e";

test.describe("Authenticated flows", () => {
  test.beforeEach(async ({ page }) => {
    await resetE2E(page);
    await loginAs(page, "primary");
  });

  test("create and edit a word post", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Share your faith").click();
    await page.getByPlaceholder("Share a verse or reflection...").fill("E2E word post");
    await page.getByRole("button", { name: "Post" }).click();

    await expect(page.getByText("E2E word post")).toBeVisible();

    const menu = page.getByRole("button", { name: "More actions" }).first();
    await menu.click();
    await page.getByRole("button", { name: "Edit Post" }).click();
    await page.locator("textarea").first().fill("E2E word post updated");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("E2E word post updated")).toBeVisible();
  });

  test("comment and like a word post", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Share your faith").click();
    await page.getByPlaceholder("Share a verse or reflection...").fill("E2E word for comment");
    await page.getByRole("button", { name: "Post" }).click();

    const card = page.locator("article", { hasText: "E2E word for comment" }).first();
    await card.getByRole("button", { name: "Comment on word" }).click();
    await card.getByPlaceholder("Write a comment...").fill("E2E word comment");
    await card.getByRole("button", { name: "Post comment" }).click();
    await expect(card.getByText("E2E word comment")).toBeVisible();

    await card.getByRole("button", { name: /Like word|Unlike word/ }).click();
  });

  test("create and edit a prayer", async ({ page }) => {
    await page.goto("/prayerwall");
    await page.getByText("Write a prayer").click();
    const dialog = page.getByRole("dialog", { name: "New Prayer" });
    await dialog.getByPlaceholder("Write your prayer...").fill("E2E prayer post");
    await dialog.getByRole("button", { name: "Pray" }).click();

    await expect(page.getByText("E2E prayer post")).toBeVisible();

    const card = page.locator("article", { hasText: "E2E prayer post" }).first();
    const menu = card.getByRole("button", { name: "More actions" });
    await menu.click();
    await page.getByRole("button", { name: "Edit Prayer" }).click();
    await card.locator("textarea").first().fill("E2E prayer post updated");
    await card.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("E2E prayer post updated")).toBeVisible();
  });

  test("comment on a prayer", async ({ page }) => {
    await page.goto("/prayerwall");
    await page.getByText("Write a prayer").click();
    const dialog = page.getByRole("dialog", { name: "New Prayer" });
    await dialog.getByPlaceholder("Write your prayer...").fill("E2E prayer for comment");
    await dialog.getByRole("button", { name: "Pray" }).click();

    const card = page.locator("article", { hasText: "E2E prayer for comment" }).first();
    await card.getByRole("button", { name: "Comment on prayer" }).click();
    await card.getByPlaceholder("Write a comment...").fill("E2E prayer comment");
    await card.getByRole("button", { name: "Post comment" }).click();
    await expect(card.getByText("E2E prayer comment")).toBeVisible();
  });

  test("profile update flow", async ({ page }) => {
    await goToProfile(page);

    await page.getByRole("button", { name: "Update profile" }).click();
    await page.getByPlaceholder("Share a short bio...").fill("E2E bio update");
    await page.getByRole("button", { name: "Update profile" }).last().click();

    await expect(page.getByText("E2E bio update")).toBeVisible();
  });

  test("search returns test users", async ({ page }) => {
    await page.goto("/search");
    const input = page.getByPlaceholder("Search people...").first();
    await input.fill("e2e");
    await expect(page.getByText("E2E Primary")).toBeVisible();
  });

  test("follow and notification flow", async ({ page }) => {
    const primary = await loginAs(page, "primary");
    await loginAs(page, "secondary");

    await page.goto(`/profile/${primary.username}`);
    await page.getByRole("button", { name: /^Follow$/ }).click();
    await expect(page.getByRole("button", { name: "Following", exact: true })).toBeVisible();

    await loginAs(page, "primary");
    await page.goto("/notifications");
    await expect(page.getByText("followed you.")).toBeVisible();
  });

  test("pray for another user's prayer triggers notification", async ({ page }) => {
    await loginAs(page, "primary");
    await page.goto("/prayerwall");
    await page.getByText("Write a prayer").click();
    const dialog = page.getByRole("dialog", { name: "New Prayer" });
    await dialog.getByPlaceholder("Write your prayer...").fill("E2E prayer for pray");
    await dialog.getByRole("button", { name: "Pray" }).click();
    await expect(page.getByText("E2E prayer for pray")).toBeVisible();

    await loginAs(page, "secondary");
    const feedResponse = await page.request.get("/api/prayers");
    expect(feedResponse.ok()).toBeTruthy();
    const feed = (await feedResponse.json()) as { items?: Array<{ _id: string; content: string }> };
    const target = feed.items?.find((item) => item.content === "E2E prayer for pray");
    expect(target?._id).toBeTruthy();
    await page.request.post(`/api/prayers/${target?._id}/pray`);

    await loginAs(page, "primary");
    const response = await page.request.get("/api/notifications");
    expect(response.ok()).toBeTruthy();
    const notifications = (await response.json()) as Array<{ type?: string }>;
    expect(notifications.some((note) => note.type === "pray")).toBeTruthy();

    await page.goto("/notifications");
    await expect(page.getByText("prayed for your prayer.")).toBeVisible();
  });

  test("delete a word post", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Share your faith").click();
    await page.getByPlaceholder("Share a verse or reflection...").fill("E2E word to delete");
    await page.getByRole("button", { name: "Post" }).click();

    await expect(page.getByText("E2E word to delete")).toBeVisible();

    const card = page.locator("article", { hasText: "E2E word to delete" }).first();
    const menu = card.getByRole("button", { name: "More actions" });
    await menu.click();
    await page.getByRole("button", { name: "Delete Post" }).click();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("E2E word to delete")).toHaveCount(0);
  });

  test("delete a prayer post", async ({ page }) => {
    await page.goto("/prayerwall");
    await page.getByText("Write a prayer").click();
    const dialog = page.getByRole("dialog", { name: "New Prayer" });
    await dialog.getByPlaceholder("Write your prayer...").fill("E2E prayer to delete");
    await dialog.getByRole("button", { name: "Pray" }).click();

    await expect(page.getByText("E2E prayer to delete")).toBeVisible();

    const card = page.locator("article", { hasText: "E2E prayer to delete" }).first();
    const menu = card.getByRole("button", { name: "More actions" });
    await menu.click();
    await page.getByRole("button", { name: "Delete Prayer" }).click();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("E2E prayer to delete")).toHaveCount(0);
  });
});

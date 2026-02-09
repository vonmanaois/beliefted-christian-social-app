import { expect, type Page } from "@playwright/test";

type LoginUser = "primary" | "secondary";

const getSecret = () => {
  const secret = process.env.E2E_BYPASS_SECRET;
  if (!secret) {
    throw new Error("E2E_BYPASS_SECRET is not set in the environment.");
  }
  return secret;
};

export const resetE2E = async (page: Page) => {
  const response = await page.request.post("/api/e2e/reset", {
    headers: { "x-e2e-secret": getSecret() },
  });
  expect(response.ok()).toBeTruthy();
};

export const loginAs = async (page: Page, user: LoginUser = "primary") => {
  const response = await page.request.post("/api/e2e/login", {
    headers: { "x-e2e-secret": getSecret() },
    data: { user },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { username?: string | null; email?: string };
};

export const goToProfile = async (page: Page) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile\//);
};

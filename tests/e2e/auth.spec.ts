import { expect, test } from "@playwright/test";

test("login and signup pages render", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText(/sign in to fitcoach ai/i)).toBeVisible();

  await page.goto("/signup");
  await expect(page.getByText(/create your fitcoach ai account/i)).toBeVisible();
});

test("protected dashboard redirects signed-out users", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByText(/sign in to fitcoach ai/i)).toBeVisible();
});

test("demo entry is hidden when demo mode is disabled", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /continue as demo user/i })).toHaveCount(0);

  await page.goto("/signup");
  await expect(page.getByRole("button", { name: /continue as demo user/i })).toHaveCount(0);
});

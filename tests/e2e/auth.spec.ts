import { expect, test } from "@playwright/test";

test("login and signup pages render", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText(/sign in to fitcoach ai/i)).toBeVisible();

  await page.goto("/signup");
  await expect(page.getByText(/create your fitcoach ai account/i)).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("methodology page explains Review Lab claim boundary", async ({ page }) => {
  await page.goto("/review-lab/methodology");
  await expect(page.getByRole("heading", { name: /review lab methodology/i })).toBeVisible();
  await expect(page.getByText(/AI coach guidance, not medical diagnosis/i)).toBeVisible();
});

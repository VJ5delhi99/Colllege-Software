import { expect, test } from "@playwright/test";

test("dashboard shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Open RBAC Console")).toBeVisible();
});

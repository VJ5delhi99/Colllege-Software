import { expect, test } from "@playwright/test";

test("chat widget accepts a prompt", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ask Admissions" }).click();
  await page.getByPlaceholder("Ask about admissions...").fill("How do I apply for admission?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Applications are open/i)).toBeVisible();
});

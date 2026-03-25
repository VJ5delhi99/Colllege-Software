import { expect, test } from "@playwright/test";

test("chat widget accepts a prompt", async ({ page }) => {
  await page.route("**/api/v1/auth/token", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "token",
        refreshToken: "refresh",
        userId: "00000000-0000-0000-0000-000000000999",
        fullName: "Prof. Kavita Menon",
        email: "principal@university360.edu",
        role: "Principal",
        tenantId: "default",
        permissions: ["analytics.view", "rbac.manage", "finance.manage"]
      })
    });
  });

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Attendance risk is stable." }) });
  });

  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.goto("/");
  await page.getByPlaceholder("Ask AI assistant...").fill("Show attendance risk");
  await page.getByRole("button", { name: "Ask AI" }).click();
  await expect(page.getByText("Attendance risk is stable.")).toBeVisible();
});

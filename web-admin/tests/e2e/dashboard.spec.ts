import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
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
});

test("dashboard shows live metric cards", async ({ page }) => {
  await page.route("**/api/v1/users", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "1" }, { id: "2" }, { id: "3" }]) });
  });
  await page.route("**/api/v1/analytics/summary", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ percentage: 92 }) });
  });
  await page.route("**/api/v1/payments/summary", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ totalCollected: 125000 }) });
  });
  await page.route("**/api/v1/dashboard/summary", async (route) => {
    const url = route.request().url();
    const body = url.includes("7004")
      ? { total: 4, latest: { title: "Exam week begins" } }
      : { nextCourse: { title: "Distributed Systems" } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("/");
  await expect(page.getByText("Enterprise command center")).toBeVisible();
  await expect(page.getByText("3")).toBeVisible();
  await expect(page.getByText("92%")).toBeVisible();
});

import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("university360_admin_session", JSON.stringify({
      accessToken: "token",
      refreshToken: "refresh",
      userId: "00000000-0000-0000-0000-000000000999",
      fullName: "Prof. Kavita Menon",
      email: "principal@university360.edu",
      role: "Principal",
      tenantId: "default",
      permissions: ["analytics.view", "rbac.manage", "finance.manage"],
      user: {
        id: "00000000-0000-0000-0000-000000000999",
        email: "principal@university360.edu",
        role: "Principal",
        tenantId: "default"
      }
    }));
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
  await expect(page.getByText("Explore campuses, compare programs, and move into admissions without the clutter.")).toBeVisible();
  await expect(page.getByText("College Management Platform")).toBeVisible();
  await expect(page.getByRole("link", { name: "Student / Faculty Login" })).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("rbac page renders roles and permissions", async ({ page }) => {
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

  await page.route("**/api/v1/roles", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "role-1", name: "Principal", description: "Leadership access" }]) });
  });

  await page.route("**/api/v1/permissions", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "perm-1", name: "analytics.view", description: "View dashboards" }]) });
  });

  await page.goto("/rbac");
  await expect(page.getByText("RBAC Catalog")).toBeVisible();
  await expect(page.getByText("Principal")).toBeVisible();
  await expect(page.getByText("analytics.view")).toBeVisible();
});

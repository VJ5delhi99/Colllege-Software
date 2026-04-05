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

test("operations hub shows notifications and audit records", async ({ page }) => {
  await page.route("**/api/v1/notifications**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "notification-1",
            title: "Mid-semester review schedule released",
            message: "The principal office has published the mid-semester review schedule.",
            audience: "Principal",
            source: "announcement",
            createdAtUtc: "2026-03-29T08:00:00Z"
          }
        ],
        page: 1,
        pageSize: 20,
        total: 1
      })
    });
  });

  await page.route("**/api/v1/audit-logs**", async (route) => {
    const url = route.request().url();
    const body = url.includes("7008")
      ? {
          items: [
            {
              id: "audit-student-1",
              action: "student.enrollment.created",
              entityId: "enrollment-1",
              actor: "Admin",
              details: "Student enrolled in CSE401 for 2026-SPRING",
              createdAtUtc: "2026-03-28T14:10:00Z"
            }
          ]
        }
      : {
          items: [
            {
              id: "audit-comm-1",
              action: "announcement.created",
              entityId: "announcement-1",
              actor: "Principal",
              details: "Mid-semester review schedule released",
              createdAtUtc: "2026-03-29T08:00:00Z"
            }
          ]
        };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...body, page: 1, pageSize: 10, total: body.items.length })
    });
  });

  await page.goto("/ops");
  await expect(page.getByText("Operations Hub")).toBeVisible();
  await expect(page.getByText("Mid-semester review schedule released").first()).toBeVisible();
  await expect(page.getByText("student.enrollment.created")).toBeVisible();
});

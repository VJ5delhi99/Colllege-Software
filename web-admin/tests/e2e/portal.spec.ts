import { expect, test } from "@playwright/test";

test("portal routes a student session into student-focused actions", async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("university360_admin_session", JSON.stringify({
      accessToken: "token",
      refreshToken: "refresh",
      userId: "00000000-0000-0000-0000-000000000123",
      fullName: "Aarav Sharma",
      email: "student@university360.edu",
      role: "Student",
      tenantId: "default",
      permissions: ["attendance.view", "results.view"],
      user: {
        id: "00000000-0000-0000-0000-000000000123",
        email: "student@university360.edu",
        role: "Student",
        tenantId: "default"
      }
    }));
  });

  await page.route("**/api/v1/students/**/summary", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ percentage: 83 }) });
  });
  await page.route("**/api/v1/results/summary", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ totalPublished: 2, averageGpa: 8.8 }) });
  });
  await page.route("**/api/v1/dashboard/summary", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ nextCourse: { title: "Distributed Systems" }, totalCourses: 3 }) });
  });
  await page.route("**/api/v1/audit-logs**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], page: 1, pageSize: 5, total: 0 }) });
  });

  await page.goto("/portal");
  await expect(page.getByText("Student workspace with the next academic step in front.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open student workspace" })).toBeVisible();
});

test("student workspace shows academic workflow metrics", async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("university360_admin_session", JSON.stringify({
      accessToken: "token",
      refreshToken: "refresh",
      userId: "00000000-0000-0000-0000-000000000123",
      fullName: "Aarav Sharma",
      email: "student@university360.edu",
      role: "Student",
      tenantId: "default",
      permissions: ["attendance.view", "results.view"],
      user: {
        id: "00000000-0000-0000-0000-000000000123",
        email: "student@university360.edu",
        role: "Student",
        tenantId: "default"
      }
    }));
  });

  await page.route("**/api/v1/students/**/summary", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ percentage: 83 }) });
  });
  await page.route("**/api/v1/results/summary", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ totalPublished: 2, averageGpa: 8.8 }) });
  });
  await page.route("**/api/v1/dashboard/summary", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ nextCourse: { title: "Distributed Systems" } }) });
  });

  await page.goto("/student");
  await expect(page.getByText("Results, attendance, and the next academic move.")).toBeVisible();
  await expect(page.getByText("83%")).toBeVisible();
  await expect(page.getByText("8.80")).toBeVisible();
});

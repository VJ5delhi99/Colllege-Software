import { expect, test } from "@playwright/test";

test("auth page signs in with valid credentials", async ({ page }) => {
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

  await page.goto("/auth");
  await page.getByLabel("Email").fill("principal@university360.edu");
  await page.getByLabel("Password").fill("principal-pass");
  await page.getByRole("button", { name: "Sign In" }).last().click();

  await expect(page.getByText("Sign-in successful.")).toBeVisible();
});

test("auth page requests password reset", async ({ page }) => {
  await page.route("**/api/v1/auth/password-reset/request", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "If the account exists, a reset code has been issued." })
    });
  });

  await page.goto("/auth");
  await page.getByRole("button", { name: "Request Reset" }).click();
  await page.getByLabel("Email").fill("principal@university360.edu");
  await page.getByRole("button", { name: "Request Reset" }).last().click();

  await expect(page.getByText("If the account exists, a reset code has been issued.")).toBeVisible();
});

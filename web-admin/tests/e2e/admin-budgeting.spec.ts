import { expect, test } from "@playwright/test";

test("admin page shows long-range budgets and forecast actions", async ({ page }) => {
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

  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === "POST" && url.includes("/api/v1/budgeting/plans/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "budget-1",
          planName: "FY 2026 operating and capital plan",
          fiscalYear: "2026-27",
          status: "Approved",
          ownerName: "Finance Planning Office",
          operatingBudgetAmount: 185000000,
          capitalBudgetAmount: 42000000,
          revenueTargetAmount: 248000000,
          committedSpendAmount: 61000000,
          contingencyReserveAmount: 12000000,
          reviewDueAtUtc: "2026-04-16T10:00:00Z"
        })
      });
      return;
    }

    const body =
      url.includes("/api/v1/users") ? [{ id: "1" }, { id: "2" }] :
      url.includes("/api/v1/payments/summary") ? { totalCollected: 57000 } :
      url.includes("/api/v1/payment-providers/readiness") ? { ready: 2 } :
      url.includes("/api/v1/dashboard/summary") ? { total: 3 } :
      url.includes("/api/v1/audit-logs") ? { items: [{ id: "audit-1" }], page: 1, pageSize: 20, total: 1 } :
      url.includes("/api/v1/auth/federation/readiness") ? { ready: 1 } :
      url.includes("/api/v1/catalog/summary") ? { campuses: 3, programs: 6 } :
      url.includes("/api/v1/admissions/summary") ? { total: 12, automation: { staleApplications: 2, overdueReminders: 1 } } :
      url.includes("/api/v1/requests/summary") ? { total: 8, fulfilled: 3, certificateRequests: 5 } :
      url.includes("/api/v1/hr/summary") ? { activeEmployees: 3, onboardingInProgress: 1, pendingLeaveRequests: 1, openRecruitment: 2, appraisalsDueSoon: 2 } :
      url.includes("/api/v1/hr/leave-requests") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/hr/recruitment/openings") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/procurement/summary") ? { openRequisitions: 2, pendingApproval: 1, purchaseOrdersOpen: 1, reorderAlerts: 1, monthlyCommittedSpend: 309000 } :
      url.includes("/api/v1/procurement/requisitions") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/procurement/purchase-orders") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/governance/summary") ? { openWorkOrders: 2, amcExpiring: 1, activeProjects: 2, complianceDeadlines: 3, openRtiCases: 2, activeIncubations: 2, contractRenewalsDue: 1, planningMilestonesDue: 1, activeResourceCampaigns: 2 } :
      url.includes("/api/v1/facility/work-orders") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/ird/projects") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/accreditation/initiatives") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/legal/cases") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/incubation/startups") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/estate/contracts") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/planning/initiatives") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/resource-generation/campaigns") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      url.includes("/api/v1/budgeting/summary") ? { plansUnderReview: 2, forecastScenariosOpen: 2, operatingBudgetAmount: 213000000, capitalBudgetAmount: 45500000, committedSpendAmount: 69500000, fundingGapAmount: 43000000 } :
      url.includes("/api/v1/budgeting/plans") ? {
        items: [
          { id: "budget-1", planName: "FY 2026 operating and capital plan", fiscalYear: "2026-27", status: "Board Review", ownerName: "Finance Planning Office", operatingBudgetAmount: 185000000, capitalBudgetAmount: 42000000, revenueTargetAmount: 248000000, committedSpendAmount: 61000000, contingencyReserveAmount: 12000000, reviewDueAtUtc: "2026-04-16T10:00:00Z" }
        ],
        page: 1,
        pageSize: 4,
        total: 1
      } :
      url.includes("/api/v1/budgeting/forecasts") ? {
        items: [
          { id: "forecast-1", scenarioName: "Three-year enrollment-led growth forecast", planningHorizonYears: 3, status: "Open", ownerName: "Strategic Planning Cell", projectedRevenueAmount: 780000000, projectedExpenseAmount: 712000000, capitalReserveAmount: 96000000, fundingGapAmount: 28000000, nextReviewAtUtc: "2026-04-14T10:00:00Z" }
        ],
        page: 1,
        pageSize: 4,
        total: 1
      } :
      url.includes("/api/v1/exam-board/summary") ? { boardReview: 1, readyToRelease: 1, dueSoon: 2 } :
      url.includes("/api/v1/exam-board/items") ? { items: [], page: 1, pageSize: 4, total: 0 } :
      {};

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body)
    });
  });

  await page.goto("/admin");
  await expect(page.getByText("Budget planning")).toBeVisible();
  await expect(page.getByText("FY 2026 operating and capital plan")).toBeVisible();

  const budgetCard = page.getByText("FY 2026 operating and capital plan").locator("xpath=ancestor::div[1]");
  await budgetCard.getByRole("button", { name: "Approve" }).click();
  await expect(budgetCard.getByText("Approved")).toBeVisible();
});

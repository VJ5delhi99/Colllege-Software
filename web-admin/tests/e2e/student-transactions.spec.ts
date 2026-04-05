import { expect, test } from "@playwright/test";

test("student page drives charge payment and request journey updates", async ({ page }) => {
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
    const url = route.request().url();
    const body = url.includes("7003")
      ? { percentage: 83 }
      : url.includes("7006")
        ? {
            totalPaid: 57000,
            pendingSessions: 0,
            outstandingAmount: 8000,
            overdueCharges: 0,
            latestPayment: { invoiceNumber: "INV-2026-002", provider: "Stripe", amount: 12000 }
          }
        : { totalPublished: 2, averageGpa: 8.8 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.route("**/api/v1/dashboard/summary", async (route) => {
    const url = route.request().url();
    const body = url.includes("7002") ? { nextCourse: { title: "Distributed Systems" } } : { total: 1, latest: { title: "Exam week begins" } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.route("**/api/v1/students/**/workspace", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        academicStatus: "Active",
        department: "Computer Science",
        batch: "2022",
        enrollmentCount: 3,
        openRequests: 1,
        recentEnrollments: [
          { id: "enrollment-1", courseCode: "CSE401", semesterCode: "2026-SPRING", status: "Enrolled", enrolledAtUtc: "2026-03-16T09:00:00Z" }
        ],
        recentRequests: [
          { id: "request-1", requestType: "Transcript Certificate", title: "Official transcript for graduate application", description: "Certificate request in progress.", status: "In Review", assignedTo: "Examination Cell", requestedAtUtc: "2026-04-02T09:00:00Z" }
        ]
      })
    });
  });

  await page.route("**/api/v1/students/**/charges", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          { id: "charge-1", chargeType: "Tuition", title: "Semester tuition installment", invoiceNumber: "INV-2026-003", amount: 8000, balanceAmount: 8000, currency: "INR", status: "Due", dueAtUtc: "2026-04-10T10:00:00Z", note: "Pending student checkout for the current installment." }
        ],
        total: 1,
        outstandingAmount: 8000,
        overdue: 0
      })
    });
  });

  await page.route("**/api/v1/students/**/requests/**/journey", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "request-1",
        requestType: "Transcript Certificate",
        title: "Official transcript for graduate application",
        status: "In Review",
        assignedTo: "Examination Cell",
        completedSteps: 2,
        totalSteps: 4,
        currentStep: "Payment clearance",
        nextAction: "Clear the payment step so the request can move into preparation.",
        readyForDownload: false,
        waitingOnPayment: true,
        steps: [
          { id: "step-1", stepName: "Request Received", stepKind: "Intake", status: "Completed", ownerName: "Student Services Desk", dueAtUtc: "2026-04-02T09:00:00Z", completedAtUtc: "2026-04-02T09:00:00Z", note: "The request was logged and routed." },
          { id: "step-2", stepName: "Payment clearance", stepKind: "PaymentClearance", status: "Pending", ownerName: "Finance Office", dueAtUtc: "2026-04-04T09:00:00Z", note: "Outstanding dues need finance confirmation." }
        ],
        activities: [
          { id: "activity-1", stageName: "Payment clearance", status: "Pending", actorName: "Finance Office", message: "Outstanding dues need finance confirmation.", createdAtUtc: "2026-04-04T09:30:00Z" }
        ]
      })
    });
  });

  await page.route("**/api/v1/helpdesk/requesters/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
  });
  await page.route("**/api/v1/workspace/summary**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ materials: 2, assignments: 2 }) });
  });
  await page.route("**/api/v1/notifications**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
  });

  await page.route("**/api/v1/students/**/charges/**/payment-sessions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "session-1",
        provider: "Razorpay",
        invoiceNumber: "INV-2026-003",
        charge: { id: "charge-1", title: "Semester tuition installment" }
      })
    });
  });

  await page.route("**/api/v1/students/**/payment-sessions/**/complete", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        payment: { invoiceNumber: "INV-2026-003", provider: "Razorpay", amount: 8000 },
        charge: { id: "charge-1", status: "Paid", balanceAmount: 0, amount: 8000, note: "Settled via Razorpay." }
      })
    });
  });

  await page.goto("/student");
  await expect(page.getByText("Semester tuition installment")).toBeVisible();
  await page.getByRole("button", { name: "Pay Next Due Item" }).click();
  await expect(page.getByText("Pending payment session via Razorpay", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Complete Latest Payment" }).click();
  await expect(page.getByText("Last paid via Razorpay", { exact: false })).toBeVisible();
});

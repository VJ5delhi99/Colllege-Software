import { expect, test, type APIRequestContext } from "@playwright/test";
import crypto from "node:crypto";

const requiredEnv = [
  "PLAYWRIGHT_LIVE_IDENTITY_API_URL",
  "PLAYWRIGHT_LIVE_STUDENT_API_URL",
  "PLAYWRIGHT_LIVE_ATTENDANCE_API_URL",
  "PLAYWRIGHT_LIVE_EXAM_API_URL",
  "PLAYWRIGHT_LIVE_FINANCE_API_URL"
] as const;

const missingEnv = requiredEnv.filter((name) => !process.env[name]);
test.skip(missingEnv.length > 0, `Missing live E2E env vars: ${missingEnv.join(", ")}`);

const tenantId = process.env.PLAYWRIGHT_LIVE_TENANT_ID ?? "default";
const studentId = "00000000-0000-0000-0000-000000000123";
const professorId = "00000000-0000-0000-0000-000000000456";

async function login(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${process.env.PLAYWRIGHT_LIVE_IDENTITY_API_URL}/api/v1/auth/token`, {
    data: { email, password, tenantId }
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("live login, enrollment, attendance, results, and payments flow", async ({ request }) => {
  const principal = await login(request, process.env.PLAYWRIGHT_LIVE_PRINCIPAL_EMAIL ?? "principal@university360.edu", process.env.PLAYWRIGHT_LIVE_PRINCIPAL_PASSWORD ?? "principal-pass");
  const professor = await login(request, process.env.PLAYWRIGHT_LIVE_PROFESSOR_EMAIL ?? "professor@university360.edu", process.env.PLAYWRIGHT_LIVE_PROFESSOR_PASSWORD ?? "professor-pass");
  const student = await login(request, process.env.PLAYWRIGHT_LIVE_STUDENT_EMAIL ?? "student@university360.edu", process.env.PLAYWRIGHT_LIVE_STUDENT_PASSWORD ?? "student-pass");
  const finance = await login(request, process.env.PLAYWRIGHT_LIVE_FINANCE_EMAIL ?? "finance@university360.edu", process.env.PLAYWRIGHT_LIVE_FINANCE_PASSWORD ?? "finance-pass");

  expect(principal.accessToken).toBeTruthy();
  expect(student.accessToken).toBeTruthy();

  const enrollmentResponse = await request.post(`${process.env.PLAYWRIGHT_LIVE_STUDENT_API_URL}/api/v1/enrollments`, {
    data: {
      tenantId,
      studentId,
      courseCode: "PHY201",
      semesterCode: "2026-SPRING",
      status: "Enrolled"
    },
    headers: {
      Authorization: `Bearer ${principal.accessToken}`,
      "X-Tenant-Id": tenantId
    }
  });
  expect(enrollmentResponse.ok()).toBeTruthy();

  const enrollmentsResponse = await request.get(`${process.env.PLAYWRIGHT_LIVE_STUDENT_API_URL}/api/v1/students/${studentId}/enrollments`, {
    headers: {
      Authorization: `Bearer ${student.accessToken}`,
      "X-Tenant-Id": tenantId
    }
  });
  expect(enrollmentsResponse.ok()).toBeTruthy();
  const enrollments = await enrollmentsResponse.json();
  expect(Array.isArray(enrollments)).toBeTruthy();
  expect(enrollments.some((item: { courseCode: string }) => item.courseCode === "PHY201")).toBeTruthy();

  const sessionResponse = await request.post(`${process.env.PLAYWRIGHT_LIVE_ATTENDANCE_API_URL}/api/v1/sessions`, {
    data: {
      tenantId,
      courseCode: "PHY201",
      professorId
    },
    headers: {
      Authorization: `Bearer ${professor.accessToken}`,
      "X-Tenant-Id": tenantId
    }
  });
  expect(sessionResponse.ok()).toBeTruthy();
  const session = await sessionResponse.json();

  const recordResponse = await request.post(`${process.env.PLAYWRIGHT_LIVE_ATTENDANCE_API_URL}/api/v1/sessions/${session.id}/records`, {
    data: {
      tenantId,
      studentId,
      courseCode: "PHY201",
      method: "QR",
      status: "Present"
    },
    headers: {
      Authorization: `Bearer ${professor.accessToken}`,
      "X-Tenant-Id": tenantId
    }
  });
  expect(recordResponse.ok()).toBeTruthy();

  const attendanceSummaryResponse = await request.get(`${process.env.PLAYWRIGHT_LIVE_ATTENDANCE_API_URL}/api/v1/students/${studentId}/summary`, {
    headers: {
      Authorization: `Bearer ${student.accessToken}`,
      "X-Tenant-Id": tenantId
    }
  });
  expect(attendanceSummaryResponse.ok()).toBeTruthy();
  const attendanceSummary = await attendanceSummaryResponse.json();
  expect(attendanceSummary.total).toBeGreaterThan(0);

  const resultsResponse = await request.get(`${process.env.PLAYWRIGHT_LIVE_EXAM_API_URL}/api/v1/results/${studentId}`, {
    headers: {
      Authorization: `Bearer ${student.accessToken}`,
      "X-Tenant-Id": tenantId
    }
  });
  expect(resultsResponse.ok()).toBeTruthy();
  const results = await resultsResponse.json();
  expect(Array.isArray(results)).toBeTruthy();

  const paymentSessionResponse = await request.post(`${process.env.PLAYWRIGHT_LIVE_FINANCE_API_URL}/api/v1/payment-sessions`, {
    data: {
      tenantId,
      studentId,
      amount: 4999,
      currency: "INR",
      provider: "Stripe",
      invoiceNumber: `INV-LIVE-${Date.now()}`
    },
    headers: {
      Authorization: `Bearer ${finance.accessToken}`,
      "X-Tenant-Id": tenantId
    }
  });
  expect(paymentSessionResponse.ok()).toBeTruthy();
  const paymentSession = await paymentSessionResponse.json();

  const payloadJson = JSON.stringify({ providerReference: paymentSession.providerReference, status: "Paid" });
  const webhookSecret = process.env.PLAYWRIGHT_LIVE_STRIPE_WEBHOOK_SECRET ?? "development-webhook-secret";
  const signature = crypto.createHmac("sha256", webhookSecret).update(payloadJson).digest("hex");

  const webhookResponse = await request.post(`${process.env.PLAYWRIGHT_LIVE_FINANCE_API_URL}/api/v1/payment-webhooks/Stripe`, {
    data: {
      providerReference: paymentSession.providerReference,
      status: "Paid",
      signature,
      payloadJson
    }
  });
  expect(webhookResponse.ok()).toBeTruthy();

  const paymentSummaryResponse = await request.get(`${process.env.PLAYWRIGHT_LIVE_FINANCE_API_URL}/api/v1/payments/summary`, {
    headers: {
      Authorization: `Bearer ${finance.accessToken}`,
      "X-Tenant-Id": tenantId
    }
  });
  expect(paymentSummaryResponse.ok()).toBeTruthy();
  const paymentSummary = await paymentSummaryResponse.json();
  expect(paymentSummary.totalTransactions).toBeGreaterThan(0);
});

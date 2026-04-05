"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiConfig } from "../api-config";
import { getAdminSession, logoutAdmin } from "../auth-client";
import { isDemoModeEnabled } from "../demo-mode";

type EnrollmentItem = {
  id: string;
  courseCode: string;
  semesterCode: string;
  status: string;
  enrolledAtUtc: string;
};

type ServiceRequestItem = {
  id: string;
  requestType: string;
  title: string;
  description: string;
  status: string;
  assignedTo?: string;
  resolutionNote?: string;
  fulfillmentReference?: string;
  deliveryChannel?: string;
  downloadUrl?: string;
  requestedAtUtc: string;
  resolvedAtUtc?: string | null;
};

type StudentChargeItem = {
  id: string;
  chargeType: string;
  title: string;
  invoiceNumber: string;
  amount: number;
  balanceAmount: number;
  currency: string;
  status: string;
  dueAtUtc: string;
  note: string;
};

type RequestJourneyStep = {
  id: string;
  stepName: string;
  stepKind: string;
  status: string;
  ownerName: string;
  dueAtUtc: string;
  completedAtUtc?: string | null;
  note: string;
};

type RequestJourneyActivity = {
  id: string;
  stageName: string;
  status: string;
  actorName: string;
  message: string;
  createdAtUtc: string;
};

type RequestJourney = {
  requestId: string;
  requestType: string;
  title: string;
  status: string;
  assignedTo: string;
  completedSteps: number;
  totalSteps: number;
  currentStep: string;
  nextAction: string;
  readyForDownload: boolean;
  waitingOnPayment: boolean;
  steps: RequestJourneyStep[];
  activities: RequestJourneyActivity[];
};

type HelpdeskTicketItem = {
  id: string;
  department: string;
  category: string;
  title: string;
  priority: string;
  status: string;
  assignedTo: string;
  resolutionNote?: string;
  createdAtUtc: string;
};

type StudentState = {
  attendancePercentage: number;
  totalPublishedResults: number;
  averageGpa: number;
  nextCourse: string;
  totalPaid: number;
  outstandingAmount: number;
  overdueCharges: number;
  pendingPayments: number;
  latestSessionId: string | null;
  latestInvoice: string;
  latestFinanceStatus: string;
  academicStatus: string;
  department: string;
  batch: string;
  enrollmentCount: number;
  learningMaterials: number;
  assignments: number;
  openRequests: number;
  recentEnrollments: EnrollmentItem[];
  recentRequests: ServiceRequestItem[];
  recentCharges: StudentChargeItem[];
  activeJourney: RequestJourney | null;
  helpdeskTickets: HelpdeskTicketItem[];
  notifications: Array<{ id: string; title: string; message: string; createdAtUtc: string }>;
};

const demoState: StudentState = {
  attendancePercentage: 83,
  totalPublishedResults: 2,
  averageGpa: 8.8,
  nextCourse: "Distributed Systems",
  totalPaid: 57000,
  outstandingAmount: 10500,
  overdueCharges: 0,
  pendingPayments: 1,
  latestSessionId: "session-1",
  latestInvoice: "INV-2026-003",
  latestFinanceStatus: "Pending payment session via PayPal",
  academicStatus: "Active",
  department: "Computer Science",
  batch: "2022",
  enrollmentCount: 3,
  learningMaterials: 2,
  assignments: 2,
  openRequests: 2,
  recentEnrollments: [
    { id: "enrollment-1", courseCode: "CSE401", semesterCode: "2026-SPRING", status: "Enrolled", enrolledAtUtc: "2026-03-16T09:00:00Z" },
    { id: "enrollment-2", courseCode: "PHY201", semesterCode: "2026-SPRING", status: "Enrolled", enrolledAtUtc: "2026-03-16T09:05:00Z" },
    { id: "enrollment-3", courseCode: "MTH301", semesterCode: "2026-SPRING", status: "Enrolled", enrolledAtUtc: "2026-03-16T09:10:00Z" }
  ],
  recentRequests: [
    {
      id: "request-1",
      requestType: "Bonafide Letter",
      title: "Need bonafide letter for internship verification",
      description: "Request raised for the internship onboarding packet.",
      status: "Submitted",
      assignedTo: "Student Services Desk",
      requestedAtUtc: "2026-04-03T10:00:00Z"
    },
    {
      id: "request-2",
      requestType: "Transcript Certificate",
      title: "Official transcript for graduate application",
      description: "Certificate request is approved and ready for pickup.",
      status: "Fulfilled",
      assignedTo: "Examination Cell",
      resolutionNote: "Printed transcript is available at the examination counter.",
      fulfillmentReference: "CERT-2026-1004",
      deliveryChannel: "Portal Download",
      downloadUrl: "https://student-documents.university360.local/download/transcript/CERT-2026-1004",
      requestedAtUtc: "2026-04-02T09:00:00Z",
      resolvedAtUtc: "2026-04-04T14:00:00Z"
    }
  ],
  recentCharges: [
    {
      id: "charge-1",
      chargeType: "Tuition",
      title: "Semester tuition installment",
      invoiceNumber: "INV-2026-003",
      amount: 8000,
      balanceAmount: 8000,
      currency: "INR",
      status: "Due",
      dueAtUtc: "2026-04-10T10:00:00Z",
      note: "Pending student checkout for the current installment."
    },
    {
      id: "charge-2",
      chargeType: "Examination",
      title: "Examination registration fee",
      invoiceNumber: "INV-2026-004",
      amount: 2500,
      balanceAmount: 2500,
      currency: "INR",
      status: "Due",
      dueAtUtc: "2026-04-17T10:00:00Z",
      note: "Required before exam hall-ticket release."
    }
  ],
  activeJourney: {
    requestId: "request-2",
    requestType: "Transcript Certificate",
    title: "Official transcript for graduate application",
    status: "In Review",
    assignedTo: "Examination Cell",
    completedSteps: 2,
    totalSteps: 4,
    currentStep: "Document preparation",
    nextAction: "Clear the payment step so the request can move into preparation.",
    readyForDownload: false,
    waitingOnPayment: true,
    steps: [
      { id: "step-1", stepName: "Request Received", stepKind: "Intake", status: "Completed", ownerName: "Student Services Desk", dueAtUtc: "2026-04-02T09:00:00Z", completedAtUtc: "2026-04-02T09:00:00Z", note: "The request was logged and routed." },
      { id: "step-2", stepName: "Examination review", stepKind: "Review", status: "Completed", ownerName: "Examination Cell", dueAtUtc: "2026-04-03T09:00:00Z", completedAtUtc: "2026-04-03T15:00:00Z", note: "Academic records were verified." },
      { id: "step-3", stepName: "Payment clearance", stepKind: "PaymentClearance", status: "Pending", ownerName: "Finance Office", dueAtUtc: "2026-04-04T09:00:00Z", note: "Outstanding dues need finance confirmation." },
      { id: "step-4", stepName: "Digital delivery", stepKind: "Delivery", status: "Pending", ownerName: "Student Services Desk", dueAtUtc: "2026-04-05T09:00:00Z", note: "The final file will be released in the student page." }
    ],
    activities: [
      { id: "activity-1", stageName: "Payment clearance", status: "Pending", actorName: "Finance Office", message: "Outstanding dues need finance confirmation.", createdAtUtc: "2026-04-04T09:30:00Z" },
      { id: "activity-2", stageName: "Examination review", status: "Completed", actorName: "Examination Cell", message: "Academic records were verified.", createdAtUtc: "2026-04-03T15:00:00Z" }
    ]
  },
  helpdeskTickets: [
    {
      id: "ticket-1",
      department: "IT Department",
      category: "Portal Access",
      title: "Unable to access semester registration portal",
      priority: "High",
      status: "Open",
      assignedTo: "Systems Desk",
      createdAtUtc: "2026-04-05T09:00:00Z"
    }
  ],
  notifications: [
    {
      id: "student-note-1",
      title: "Semester exams begin on April 12",
      message: "Review the updated exam timetable and hall policies before reporting.",
      createdAtUtc: "2026-04-04T09:30:00Z"
    },
    {
      id: "student-note-2",
      title: "Library hours extended",
      message: "Late-evening access is open through the assessment week.",
      createdAtUtc: "2026-04-03T17:00:00Z"
    }
  ]
};

function formatMoney(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function loadOptionalJson(url: string, headers: HeadersInit) {
  try {
    const response = await fetchWithTimeout(url, { headers });
    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

function createDemoJourney(request: ServiceRequestItem): RequestJourney {
  return {
    requestId: request.id,
    requestType: request.requestType,
    title: request.title,
    status: "Submitted",
    assignedTo: request.assignedTo ?? "Student Services Desk",
    completedSteps: 1,
    totalSteps: 3,
    currentStep: "Service review",
    nextAction: "The request is waiting for service review.",
    readyForDownload: false,
    waitingOnPayment: false,
    steps: [
      {
        id: `${request.id}-step-1`,
        stepName: "Request Received",
        stepKind: "Intake",
        status: "Completed",
        ownerName: "Student Services Desk",
        dueAtUtc: request.requestedAtUtc,
        completedAtUtc: request.requestedAtUtc,
        note: "The request was logged and routed."
      },
      {
        id: `${request.id}-step-2`,
        stepName: "Service review",
        stepKind: "Review",
        status: "Pending",
        ownerName: request.assignedTo ?? "Student Services Desk",
        dueAtUtc: request.requestedAtUtc,
        note: "The request is being checked by the assigned team."
      },
      {
        id: `${request.id}-step-3`,
        stepName: "Student update",
        stepKind: "Delivery",
        status: "Pending",
        ownerName: request.assignedTo ?? "Student Services Desk",
        dueAtUtc: request.requestedAtUtc,
        note: "The final update will be shared in this page."
      }
    ],
    activities: [
      {
        id: `${request.id}-activity-1`,
        stageName: "Request Received",
        status: "Completed",
        actorName: request.assignedTo ?? "Student Services Desk",
        message: `${request.requestType} request submitted from the student page.`,
        createdAtUtc: request.requestedAtUtc
      }
    ]
  };
}

export default function StudentPage() {
  const [state, setState] = useState<StudentState>(demoState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const demoMode = isDemoModeEnabled();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await getAdminSession();

        if (demoMode) {
          if (!cancelled) {
            setState(demoState);
            setError(null);
            setLoading(false);
          }
          return;
        }

        const headers = {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        };

        const [attendanceResponse, resultSummaryResponse, academicResponse, financeResponse, notificationsResponse, workspaceResponse] = await Promise.all([
          fetchWithTimeout(`${apiConfig.attendance()}/api/v1/students/${session.user.id}/summary`, { headers }),
          fetchWithTimeout(`${apiConfig.exam()}/api/v1/students/${session.user.id}/summary`, { headers }),
          fetchWithTimeout(`${apiConfig.academic()}/api/v1/dashboard/summary`, { headers }),
          fetchWithTimeout(`${apiConfig.finance()}/api/v1/students/${session.user.id}/summary`, { headers }),
          fetchWithTimeout(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}&pageSize=5`, { headers }),
          fetchWithTimeout(`${apiConfig.student()}/api/v1/students/${session.user.id}/workspace`, { headers })
        ]);

        if (!attendanceResponse.ok || !resultSummaryResponse.ok || !academicResponse.ok || !financeResponse.ok || !notificationsResponse.ok || !workspaceResponse.ok) {
          throw new Error("Unable to load the student workspace.");
        }

        const [attendancePayload, resultSummaryPayload, academicPayload, financePayload, notificationsPayload, workspacePayload] = await Promise.all([
          attendanceResponse.json(),
          resultSummaryResponse.json(),
          academicResponse.json(),
          financeResponse.json(),
          notificationsResponse.json(),
          workspaceResponse.json()
        ]);

        const courseCodes = Array.from(new Set(((workspacePayload?.recentEnrollments ?? []) as EnrollmentItem[]).map((item) => item.courseCode)));
        const focusRequestId = ((workspacePayload?.recentRequests ?? []) as ServiceRequestItem[]).find((item) => item.status !== "Fulfilled")?.id
          ?? ((workspacePayload?.recentRequests ?? []) as ServiceRequestItem[])[0]?.id;

        const [helpdeskPayload, lmsSummaryPayload, chargesPayload, journeyPayload] = await Promise.all([
          loadOptionalJson(`${apiConfig.communication()}/api/v1/helpdesk/requesters/${session.user.id}/tickets?pageSize=4`, headers),
          loadOptionalJson(
            `${apiConfig.lms()}/api/v1/workspace/summary${courseCodes.length > 0 ? `?courseCodes=${encodeURIComponent(courseCodes.join(","))}` : ""}`,
            headers
          ),
          loadOptionalJson(`${apiConfig.finance()}/api/v1/students/${session.user.id}/charges`, headers),
          focusRequestId
            ? loadOptionalJson(`${apiConfig.student()}/api/v1/students/${session.user.id}/requests/${focusRequestId}/journey`, headers)
            : Promise.resolve(null)
        ]);

        if (!cancelled) {
          setState({
            attendancePercentage: attendancePayload?.percentage ?? 0,
            totalPublishedResults: resultSummaryPayload?.totalPublished ?? 0,
            averageGpa: resultSummaryPayload?.averageGpa ?? 0,
            nextCourse: academicPayload?.nextCourse?.title ?? "No class scheduled",
            totalPaid: financePayload?.totalPaid ?? 0,
            outstandingAmount: financePayload?.outstandingAmount ?? chargesPayload?.outstandingAmount ?? 0,
            overdueCharges: financePayload?.overdueCharges ?? chargesPayload?.overdue ?? 0,
            pendingPayments: financePayload?.pendingSessions ?? 0,
            latestSessionId: financePayload?.latestSession?.id ?? null,
            latestInvoice: financePayload?.latestSession?.invoiceNumber ?? financePayload?.latestPayment?.invoiceNumber ?? "No invoice",
            latestFinanceStatus: financePayload?.latestSession
              ? `Pending payment session via ${financePayload.latestSession.provider ?? "gateway"}`
              : financePayload?.latestPayment
                ? `Last paid via ${financePayload.latestPayment.provider ?? "gateway"}`
                : "No finance activity yet",
            academicStatus: workspacePayload?.academicStatus ?? "Unknown",
            department: workspacePayload?.department ?? "Not mapped",
            batch: workspacePayload?.batch ?? "N/A",
            enrollmentCount: workspacePayload?.enrollmentCount ?? 0,
            learningMaterials: lmsSummaryPayload?.materials ?? 0,
            assignments: lmsSummaryPayload?.assignments ?? 0,
            openRequests: workspacePayload?.openRequests ?? 0,
            recentEnrollments: (workspacePayload?.recentEnrollments ?? []) as EnrollmentItem[],
            recentRequests: (workspacePayload?.recentRequests ?? []) as ServiceRequestItem[],
            recentCharges: (chargesPayload?.items ?? []) as StudentChargeItem[],
            activeJourney: (journeyPayload ?? null) as RequestJourney | null,
            helpdeskTickets: (helpdeskPayload?.items ?? []) as HelpdeskTicketItem[],
            notifications: notificationsPayload?.items ?? []
          });
          setError(null);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          if (loadError instanceof Error && loadError.message.includes("No admin session")) {
            window.location.href = "/auth?role=Student&redirect=%2Fstudent";
            return;
          }
          setError(loadError instanceof Error ? loadError.message : "Unexpected student workspace error.");
          setLoading(false);
        }
      }
    }

    load();
    const intervalId = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [demoMode]);

  async function handleSignOut() {
    setSigningOut(true);
    await logoutAdmin().catch(() => null);
    window.location.href = "/auth";
  }

  async function submitRequest(requestType: string, title: string, description: string) {
    setRequesting(requestType);

    try {
      if (demoMode) {
        const nextRequest: ServiceRequestItem = {
          id: `demo-${Date.now()}`,
          requestType,
          title,
          description,
          status: "Submitted",
          requestedAtUtc: new Date().toISOString()
        };
        setState((current) => ({
          ...current,
          openRequests: current.openRequests + 1,
          recentRequests: [nextRequest, ...current.recentRequests].slice(0, 4),
          activeJourney: createDemoJourney(nextRequest)
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.student()}/api/v1/students/${session.user.id}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          requestType,
          title,
          description
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to submit the request.");
      }

      const payload = (await response.json()) as ServiceRequestItem;
      const journeyPayload = await loadOptionalJson(`${apiConfig.student()}/api/v1/students/${session.user.id}/requests/${payload.id}/journey`, {
        Authorization: `Bearer ${session.accessToken}`,
        "X-Tenant-Id": session.user.tenantId
      });
      setState((current) => ({
        ...current,
        openRequests: current.openRequests + 1,
        recentRequests: [payload, ...current.recentRequests].slice(0, 4),
        activeJourney: (journeyPayload ?? current.activeJourney) as RequestJourney | null
      }));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to submit the request.");
    } finally {
      setRequesting(null);
    }
  }

  async function submitSupportTicket() {
    setRequesting("Support Ticket");

    try {
      if (demoMode) {
        const nextTicket: HelpdeskTicketItem = {
          id: `ticket-${Date.now()}`,
          department: "IT Department",
          category: "Portal Access",
          title: "Need help with student portal access",
          priority: "High",
          status: "Open",
          assignedTo: "Systems Desk",
          createdAtUtc: new Date().toISOString()
        };
        setState((current) => ({
          ...current,
          helpdeskTickets: [nextTicket, ...current.helpdeskTickets].slice(0, 4)
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/helpdesk/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          requesterId: session.user.id,
          requesterName: session.user.email,
          requesterRole: session.user.role,
          department: "IT Department",
          category: "Portal Access",
          title: "Need help with student portal access",
          description: "Raising a support ticket from the student self-service workspace.",
          priority: "High"
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to submit the support ticket.");
      }

      const payload = (await response.json()) as HelpdeskTicketItem;
      setState((current) => ({
        ...current,
        helpdeskTickets: [payload, ...current.helpdeskTickets].slice(0, 4)
      }));
      setError(null);
    } catch (ticketError) {
      setError(ticketError instanceof Error ? ticketError.message : "Unable to submit the support ticket.");
    } finally {
      setRequesting(null);
    }
  }

  async function startPaymentSession() {
    setPaying(true);

    try {
      const nextCharge = state.recentCharges.find((item) => item.balanceAmount > 0 && item.status !== "Paid");
      if (demoMode) {
        setState((current) => ({
          ...current,
          pendingPayments: current.pendingPayments + 1,
          latestSessionId: `demo-session-${Date.now()}`,
          latestInvoice: nextCharge?.invoiceNumber ?? `INV-${new Date().getFullYear()}-010`,
          latestFinanceStatus: `Pending payment session via Razorpay${nextCharge ? ` for ${nextCharge.title}` : ""}`
        }));
        return;
      }

      const session = await getAdminSession();
      const invoiceNumber = nextCharge?.invoiceNumber ?? `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
      const response = await fetch(nextCharge
        ? `${apiConfig.finance()}/api/v1/students/${session.user.id}/charges/${nextCharge.id}/payment-sessions`
        : `${apiConfig.finance()}/api/v1/students/${session.user.id}/payment-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify(nextCharge
          ? {
              tenantId: session.user.tenantId,
              provider: "Razorpay"
            }
          : {
              tenantId: session.user.tenantId,
              amount: 8000,
              currency: "INR",
              provider: "Razorpay",
              invoiceNumber
            })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to create payment session.");
      }

      const payload = await response.json();
      setState((current) => ({
        ...current,
        pendingPayments: current.pendingPayments + 1,
        latestSessionId: payload?.sessionId ?? current.latestSessionId,
        latestInvoice: payload?.invoiceNumber ?? invoiceNumber,
        latestFinanceStatus: `Pending payment session via ${payload?.provider ?? "gateway"}${payload?.charge?.title ? ` for ${payload.charge.title}` : ""}`
      }));
      setError(null);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Unable to create payment session.");
    } finally {
      setPaying(false);
    }
  }

  async function completeLatestPayment() {
    if (!state.latestSessionId) {
      return;
    }

    setPaying(true);

    try {
      if (demoMode) {
        setState((current) => ({
          ...current,
          totalPaid: current.totalPaid + 8000,
          outstandingAmount: Math.max(current.outstandingAmount - 8000, 0),
          pendingPayments: Math.max(current.pendingPayments - 1, 0),
          latestSessionId: null,
          latestFinanceStatus: "Last paid via Razorpay",
          recentCharges: current.recentCharges.map((item, index) =>
            index === 0 ? { ...item, status: "Paid", balanceAmount: 0, note: "Settled from the student page." } : item
          )
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.finance()}/api/v1/students/${session.user.id}/payment-sessions/${state.latestSessionId}/complete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        }
      });

      if (!response.ok) {
        throw new Error("Unable to complete payment session.");
      }

      const payload = await response.json();
      const payment = payload?.payment;
      const charge = payload?.charge;
      setState((current) => ({
        ...current,
        totalPaid: current.totalPaid + (payment?.amount ?? 0),
        outstandingAmount: Math.max(current.outstandingAmount - (charge?.amount ?? payment?.amount ?? 0), 0),
        pendingPayments: Math.max(current.pendingPayments - 1, 0),
        latestSessionId: null,
        latestInvoice: payment?.invoiceNumber ?? current.latestInvoice,
        latestFinanceStatus: `Last paid via ${payment?.provider ?? "gateway"}`,
        recentCharges: current.recentCharges.map((item) => item.id === charge?.id ? { ...item, ...charge } : item)
      }));
      setError(null);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Unable to complete payment session.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <main className="panel-grid min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(7,18,34,0.95),rgba(14,40,73,0.86)_58%,rgba(5,13,25,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Student workspace</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Self-service academics, learning queue, and request workflows in one place.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                The student surface now goes beyond summary cards by exposing profile context, enrollments, learning content, and operational requests.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/portal" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                Open Portal
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                {signingOut ? "Signing Out..." : "Sign Out"}
              </button>
            </div>
          </div>
        </section>

        {error ? <div className="mt-6 rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-50">{error}</div> : null}

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Attendance</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : `${state.attendancePercentage}%`}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Monitor attendance recovery before it impacts eligibility.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Average GPA</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.averageGpa.toFixed(2)}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Published academic performance instead of a generic grade placeholder.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Enrollments</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.enrollmentCount}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Current semester course ownership visible in the student flow.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Open requests</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.openRequests}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Self-service items like letters, leave, and fee review no longer live outside the product.</p>
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Academic identity</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{loading ? "Loading profile..." : `${state.department} | Batch ${state.batch}`}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Status: {loading ? "..." : state.academicStatus}. Next course: {loading ? "..." : state.nextCourse}.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Total paid</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : formatMoney(state.totalPaid)}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Amount due</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : formatMoney(state.outstandingAmount)}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Pending payments</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.pendingPayments}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Overdue items</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.overdueCharges}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-300">{loading ? "Loading finance..." : `${state.latestInvoice} | ${state.latestFinanceStatus}`}</p>
              <button
                type="button"
                onClick={startPaymentSession}
                disabled={paying}
                className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-60"
              >
                {paying ? "Preparing..." : "Pay Next Due Item"}
              </button>
              <button
                type="button"
                onClick={completeLatestPayment}
                disabled={paying || !state.latestSessionId}
                className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
              >
                {paying ? "Updating..." : "Complete Latest Payment"}
              </button>
            </div>
            <div className="mt-6 space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current dues and fee items</p>
              {state.recentCharges.map((item) => (
                <article key={item.id} className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.chargeType} | {item.invoiceNumber}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{formatMoney(item.balanceAmount)} due by {formatTimestamp(item.dueAtUtc)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.note}</p>
                </article>
              ))}
              {!loading && state.recentCharges.length === 0 ? <div className="rounded-[1.2rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No student charges are waiting right now.</div> : null}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Learning queue</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Assignments and materials are part of the student view now</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {loading ? "Loading" : `${state.learningMaterials} materials | ${state.assignments} assignments`}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {state.recentEnrollments.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-sm font-medium text-white">{item.courseCode}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.semesterCode}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{item.status} | {formatTimestamp(item.enrolledAtUtc)}</p>
                </article>
              ))}
              {!loading && state.recentEnrollments.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No enrollments are available yet.</div> : null}
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Self-service</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Raise common student requests without leaving the platform</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {loading ? "Loading" : `${state.recentRequests.length} recent`}
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => submitRequest("Bonafide Letter", "Need bonafide letter for internship verification", "Auto-requested from the student workspace.")}
                disabled={requesting !== null}
                className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
              >
                {requesting === "Bonafide Letter" ? "Submitting..." : "Request Bonafide"}
              </button>
              <button
                type="button"
                onClick={() => submitRequest("Leave Request", "Medical leave for an upcoming class", "Attendance consideration requested from the student cockpit.")}
                disabled={requesting !== null}
                className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 disabled:opacity-60"
              >
                {requesting === "Leave Request" ? "Submitting..." : "Request Leave"}
              </button>
              <button
                type="button"
                onClick={() => submitRequest("Fee Review", "Need fee schedule clarification", "Asked for payment plan clarification from the self-service view.")}
                disabled={requesting !== null}
                className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-60"
              >
                {requesting === "Fee Review" ? "Submitting..." : "Ask for Fee Review"}
              </button>
            </div>

            <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Current request progress</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{state.activeJourney?.title ?? "No request selected"}</h3>
                </div>
                {state.activeJourney ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                    {state.activeJourney.completedSteps}/{state.activeJourney.totalSteps} steps
                  </span>
                ) : null}
              </div>
              {state.activeJourney ? (
                <>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{state.activeJourney.requestType} | {state.activeJourney.status} | {state.activeJourney.currentStep}</p>
                  <p className="mt-2 text-sm leading-6 text-cyan-100/90">{state.activeJourney.nextAction}</p>
                  <div className="mt-4 space-y-3">
                    {state.activeJourney.steps.map((step) => (
                      <div key={step.id} className="rounded-[1rem] border border-white/10 bg-slate-950/40 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">{step.stepName}</p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">{step.status}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{step.ownerName} | due {formatTimestamp(step.dueAtUtc)}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{step.note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-3">
                    {state.activeJourney.activities.map((item) => (
                      <div key={item.id} className="rounded-[1rem] border border-white/10 bg-slate-950/30 px-3 py-3">
                        <p className="text-sm font-medium text-white">{item.stageName} | {item.status}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{item.message}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-cyan-200">{item.actorName} | {formatTimestamp(item.createdAtUtc)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-400">Open a request to see each step, the current owner, and the latest activity in one place.</p>
              )}
            </div>

            <div className="mt-5 space-y-4">
              {state.recentRequests.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.requestType}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                  {item.assignedTo ? <p className="mt-2 text-sm leading-6 text-slate-400">Assigned to: {item.assignedTo}</p> : null}
                  {item.resolutionNote ? <p className="mt-2 text-sm leading-6 text-emerald-200">{item.resolutionNote}</p> : null}
                  {item.fulfillmentReference ? <p className="mt-2 text-sm leading-6 text-cyan-200">Reference: {item.fulfillmentReference}</p> : null}
                  {item.deliveryChannel ? <p className="mt-2 text-sm leading-6 text-cyan-200">Delivery: {item.deliveryChannel}</p> : null}
                  {item.downloadUrl ? (
                    <a href={item.downloadUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-medium text-cyan-200 transition hover:text-cyan-100">
                      Open document download
                    </a>
                  ) : null}
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{formatTimestamp(item.requestedAtUtc)}</p>
                  {item.resolvedAtUtc ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-emerald-200">Resolved {formatTimestamp(item.resolvedAtUtc)}</p> : null}
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Notifications</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Recent student-facing updates</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {loading ? "Loading" : `${state.notifications.length} items`}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {state.notifications.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.message}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{formatTimestamp(item.createdAtUtc)}</p>
                </article>
              ))}
              {!loading && state.notifications.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No notifications are available yet.</div> : null}
            </div>
          </article>
        </section>

        <section className="mt-6">
          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Helpdesk</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Department support ticketing from the self-service portal</h2>
              </div>
              <button
                type="button"
                onClick={submitSupportTicket}
                disabled={requesting !== null}
                className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-60"
              >
                {requesting === "Support Ticket" ? "Submitting..." : "Raise IT Ticket"}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {state.helpdeskTickets.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.department} | {item.category} | {item.priority}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Assigned to: {item.assignedTo || "Unassigned"}</p>
                  {item.resolutionNote ? <p className="mt-2 text-sm leading-6 text-emerald-200">{item.resolutionNote}</p> : null}
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{formatTimestamp(item.createdAtUtc)}</p>
                </article>
              ))}
              {!loading && state.helpdeskTickets.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No support tickets have been raised yet.</div> : null}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiConfig } from "../api-config";
import { getAdminSession, logoutAdmin } from "../auth-client";
import { isDemoModeEnabled } from "../demo-mode";

type HrLeaveItem = { id: string; employeeName: string; leaveType: string; status: string; approverName?: string; startDateUtc: string; endDateUtc: string };
type RecruitmentOpeningItem = { id: string; title: string; departmentName: string; status: string; openPositions: number; candidatePipelineCount: number };
type ProcurementRequisitionItem = { id: string; title: string; departmentName: string; requesterName: string; status: string; priority: string; amount: number };
type PurchaseOrderItem = { id: string; orderNumber: string; vendorName: string; status: string; amount: number; expectedDeliveryUtc: string };
type FacilityWorkOrderItem = { id: string; title: string; category: string; status: string; priority: string; assignedTo: string; dueAtUtc: string; amcStatus: string };
type ResearchProjectItem = { id: string; title: string; departmentName: string; sponsorName: string; status: string; principalInvestigator: string; budgetAmount: number; milestoneDueAtUtc: string; complianceStatus: string };
type AccreditationInitiativeItem = { id: string; frameworkName: string; cycleName: string; status: string; ownerName: string; evidenceCount: number; dueAtUtc: string };
type LegalCaseItem = { id: string; caseType: string; title: string; status: string; ownerName: string; forumName: string; dueAtUtc: string; riskLevel: string };
type IncubationStartupItem = { id: string; cohortName: string; startupName: string; status: string; mentorName: string; fundingStage: string; reviewDueAtUtc: string };

type AdminState = {
  userCount: number;
  feeCollection: number;
  auditCount: number;
  announcementCount: number;
  campusCount: number;
  programCount: number;
  inquiryCount: number;
  staleAdmissions: number;
  overdueReminders: number;
  federationReady: number;
  paymentReady: number;
  studentRequests: number;
  fulfilledRequests: number;
  certificateRequests: number;
  activeEmployees: number;
  onboardingInProgress: number;
  pendingLeaveRequests: number;
  openRecruitment: number;
  appraisalsDueSoon: number;
  openRequisitions: number;
  pendingProcurementApproval: number;
  purchaseOrdersOpen: number;
  reorderAlerts: number;
  monthlyCommittedSpend: number;
  openWorkOrders: number;
  amcExpiring: number;
  activeResearchProjects: number;
  complianceDeadlines: number;
  openLegalCases: number;
  activeIncubations: number;
  leaveRequests: HrLeaveItem[];
  recruitmentOpenings: RecruitmentOpeningItem[];
  procurementRequisitions: ProcurementRequisitionItem[];
  purchaseOrders: PurchaseOrderItem[];
  facilityWorkOrders: FacilityWorkOrderItem[];
  researchProjects: ResearchProjectItem[];
  accreditationItems: AccreditationInitiativeItem[];
  legalCases: LegalCaseItem[];
  incubationStartups: IncubationStartupItem[];
};

const now = Date.now();
const demoState: AdminState = {
  userCount: 2480,
  feeCollection: 57000,
  auditCount: 18,
  announcementCount: 6,
  campusCount: 3,
  programCount: 6,
  inquiryCount: 12,
  staleAdmissions: 2,
  overdueReminders: 1,
  federationReady: 1,
  paymentReady: 2,
  studentRequests: 8,
  fulfilledRequests: 3,
  certificateRequests: 5,
  activeEmployees: 3,
  onboardingInProgress: 1,
  pendingLeaveRequests: 1,
  openRecruitment: 2,
  appraisalsDueSoon: 2,
  openRequisitions: 2,
  pendingProcurementApproval: 1,
  purchaseOrdersOpen: 1,
  reorderAlerts: 1,
  monthlyCommittedSpend: 309000,
  openWorkOrders: 2,
  amcExpiring: 1,
  activeResearchProjects: 2,
  complianceDeadlines: 3,
  openLegalCases: 2,
  activeIncubations: 2,
  leaveRequests: [
    { id: "leave-1", employeeName: "Rhea Kapoor", leaveType: "Conference Leave", status: "Pending Approval", approverName: "Dr. Priya Menon", startDateUtc: new Date(now + 6 * 86400000).toISOString(), endDateUtc: new Date(now + 8 * 86400000).toISOString() },
    { id: "leave-2", employeeName: "Farah Thomas", leaveType: "Casual Leave", status: "Approved", approverName: "Rahul George", startDateUtc: new Date(now + 2 * 86400000).toISOString(), endDateUtc: new Date(now + 3 * 86400000).toISOString() }
  ],
  recruitmentOpenings: [
    { id: "opening-1", title: "Associate Professor - AI Systems", departmentName: "Computer Science", status: "Interviewing", openPositions: 2, candidatePipelineCount: 11 },
    { id: "opening-2", title: "Hostel Operations Supervisor", departmentName: "Campus Services", status: "Open", openPositions: 1, candidatePipelineCount: 5 }
  ],
  procurementRequisitions: [
    { id: "req-1", title: "Replace projector units for seminar halls", departmentName: "Campus Services", requesterName: "Madhav Iyer", status: "Pending Approval", priority: "High", amount: 185000 },
    { id: "req-2", title: "Biochemistry reagent refill", departmentName: "Biosciences", requesterName: "Dr. Asha Varma", status: "Approved", priority: "Medium", amount: 62000 }
  ],
  purchaseOrders: [
    { id: "po-1", orderNumber: "PO-2026-1001", vendorName: "Labline Scientific", status: "Issued", amount: 62000, expectedDeliveryUtc: new Date(now + 4 * 86400000).toISOString() }
  ],
  facilityWorkOrders: [
    { id: "facility-1", title: "Chiller plant preventive maintenance", category: "Utilities", status: "Scheduled", priority: "High", assignedTo: "Campus Engineering", dueAtUtc: new Date(now + 3 * 86400000).toISOString(), amcStatus: "Expiring Soon" },
    { id: "facility-2", title: "Library access control audit", category: "Security", status: "In Progress", priority: "Medium", assignedTo: "Security Office", dueAtUtc: new Date(now + 1 * 86400000).toISOString(), amcStatus: "Healthy" }
  ],
  researchProjects: [
    { id: "project-1", title: "AI-enabled crop resilience platform", departmentName: "Computer Science", sponsorName: "DST Innovation Grant", status: "Active", principalInvestigator: "Dr. Priya Menon", budgetAmount: 4200000, milestoneDueAtUtc: new Date(now + 10 * 86400000).toISOString(), complianceStatus: "Report Due" },
    { id: "project-2", title: "Low-cost rapid diagnostics study", departmentName: "Biosciences", sponsorName: "State Health Mission", status: "Grant Review", principalInvestigator: "Dr. Asha Varma", budgetAmount: 2750000, milestoneDueAtUtc: new Date(now + 18 * 86400000).toISOString(), complianceStatus: "Ethics Submitted" }
  ],
  accreditationItems: [
    { id: "accr-1", frameworkName: "NBA", cycleName: "Outcome assessment 2026", status: "Evidence Collection", ownerName: "Quality Assurance Cell", evidenceCount: 18, dueAtUtc: new Date(now + 12 * 86400000).toISOString() },
    { id: "accr-2", frameworkName: "NAAC", cycleName: "SSR criterion refresh", status: "Review Pending", ownerName: "IQAC", evidenceCount: 24, dueAtUtc: new Date(now + 7 * 86400000).toISOString() }
  ],
  legalCases: [
    { id: "legal-1", caseType: "RTI", title: "Scholarship allocation disclosure request", status: "Response Drafting", ownerName: "Registrar Office", forumName: "Public Information Desk", dueAtUtc: new Date(now + 4 * 86400000).toISOString(), riskLevel: "Medium" },
    { id: "legal-2", caseType: "Legal Notice", title: "Vendor contract renewal clarification", status: "Counsel Review", ownerName: "Legal Cell", forumName: "External Counsel", dueAtUtc: new Date(now + 9 * 86400000).toISOString(), riskLevel: "Low" }
  ],
  incubationStartups: [
    { id: "inc-1", cohortName: "Spring 2026", startupName: "CircuitNest", status: "Mentoring", mentorName: "Prof. Rohan Iyer", fundingStage: "Prototype Grant", reviewDueAtUtc: new Date(now + 6 * 86400000).toISOString() },
    { id: "inc-2", cohortName: "Spring 2026", startupName: "BioWeave Labs", status: "Compliance Review", mentorName: "Dr. Asha Varma", fundingStage: "Seed Readiness", reviewDueAtUtc: new Date(now + 11 * 86400000).toISOString() }
  ]
};

const money = (value: number) => `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));

export default function AdminPage() {
  const [state, setState] = useState(demoState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
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

        const headers = { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId };
        const responses = await Promise.all([
          fetch(`${apiConfig.identity()}/api/v1/users`, { headers }),
          fetch(`${apiConfig.finance()}/api/v1/payments/summary`, { headers }),
          fetch(`${apiConfig.finance()}/api/v1/payment-providers/readiness`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/dashboard/summary`, { headers }),
          fetch(`${apiConfig.identity()}/api/v1/audit-logs?pageSize=20`, { headers }),
          fetch(`${apiConfig.identity()}/api/v1/auth/federation/readiness`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/catalog/summary`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/admissions/summary`, { headers }),
          fetch(`${apiConfig.student()}/api/v1/requests/summary`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/hr/summary`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/hr/leave-requests?pageSize=4`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/hr/recruitment/openings?pageSize=4`, { headers }),
          fetch(`${apiConfig.finance()}/api/v1/procurement/summary`, { headers }),
          fetch(`${apiConfig.finance()}/api/v1/procurement/requisitions?pageSize=4`, { headers }),
          fetch(`${apiConfig.finance()}/api/v1/procurement/purchase-orders?pageSize=4`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/governance/summary`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/facility/work-orders?pageSize=4`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/ird/projects?pageSize=4`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/accreditation/initiatives?pageSize=4`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/legal/cases?pageSize=4`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/incubation/startups?pageSize=4`, { headers })
        ]);

        if (responses.some((response) => !response.ok)) {
          throw new Error("Unable to load the admin workspace.");
        }

        const [users, finance, payment, comms, audit, federation, catalog, admissions, requests, hr, leaves, openings, procurement, requisitions, orders, governance, workOrders, researchProjects, accreditation, legalCases, incubation] = await Promise.all(responses.map((response) => response.json()));
        if (!cancelled) {
          setState({
            userCount: Array.isArray(users) ? users.length : 0,
            feeCollection: finance?.totalCollected ?? 0,
            auditCount: audit?.items?.length ?? 0,
            announcementCount: comms?.total ?? 0,
            campusCount: catalog?.campuses ?? 0,
            programCount: catalog?.programs ?? 0,
            inquiryCount: admissions?.total ?? 0,
            staleAdmissions: admissions?.automation?.staleApplications ?? 0,
            overdueReminders: admissions?.automation?.overdueReminders ?? 0,
            federationReady: federation?.ready ?? 0,
            paymentReady: payment?.ready ?? 0,
            studentRequests: requests?.total ?? 0,
            fulfilledRequests: requests?.fulfilled ?? 0,
            certificateRequests: requests?.certificateRequests ?? 0,
            activeEmployees: hr?.activeEmployees ?? 0,
            onboardingInProgress: hr?.onboardingInProgress ?? 0,
            pendingLeaveRequests: hr?.pendingLeaveRequests ?? 0,
            openRecruitment: hr?.openRecruitment ?? 0,
            appraisalsDueSoon: hr?.appraisalsDueSoon ?? 0,
            openRequisitions: procurement?.openRequisitions ?? 0,
            pendingProcurementApproval: procurement?.pendingApproval ?? 0,
            purchaseOrdersOpen: procurement?.purchaseOrdersOpen ?? 0,
            reorderAlerts: procurement?.reorderAlerts ?? 0,
            monthlyCommittedSpend: procurement?.monthlyCommittedSpend ?? 0,
            openWorkOrders: governance?.openWorkOrders ?? 0,
            amcExpiring: governance?.amcExpiring ?? 0,
            activeResearchProjects: governance?.activeProjects ?? 0,
            complianceDeadlines: governance?.complianceDeadlines ?? 0,
            openLegalCases: governance?.openRtiCases ?? 0,
            activeIncubations: governance?.activeIncubations ?? 0,
            leaveRequests: leaves?.items ?? [],
            recruitmentOpenings: openings?.items ?? [],
            procurementRequisitions: requisitions?.items ?? [],
            purchaseOrders: orders?.items ?? [],
            facilityWorkOrders: workOrders?.items ?? [],
            researchProjects: researchProjects?.items ?? [],
            accreditationItems: accreditation?.items ?? [],
            legalCases: legalCases?.items ?? [],
            incubationStartups: incubation?.items ?? []
          });
          setError(null);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          if (loadError instanceof Error && loadError.message.includes("No admin session")) {
            window.location.href = "/auth?role=Admin&redirect=%2Fadmin";
            return;
          }
          setError(loadError instanceof Error ? loadError.message : "Unexpected admin workspace error.");
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

  async function mutate(itemKey: string, url: string, body: Record<string, string>, applyDemo: () => void, applyLive: (payload: any) => void) {
    setUpdating(itemKey);
    try {
      if (demoMode) {
        applyDemo();
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error("Update failed");
      }

      applyLive(await response.json());
    } catch {
      setError("A workspace action is unavailable right now.");
    } finally {
      setUpdating(null);
    }
  }

  async function signOut() {
    setSigningOut(true);
    await logoutAdmin().catch(() => null);
    window.location.href = "/auth";
  }

  return (
    <main className="panel-grid min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(17,7,34,0.95),rgba(42,14,73,0.86)_58%,rgba(10,5,25,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-fuchsia-300">Admin workspace</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Institution-wide control with public-to-ops visibility.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">The admin view now carries catalog, admissions, HR, and procurement in one operating surface.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/ops" className="rounded-full bg-fuchsia-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-200">Open Operations Hub</Link>
              <button type="button" onClick={signOut} disabled={signingOut} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60">{signingOut ? "Signing Out..." : "Sign Out"}</button>
            </div>
          </div>
        </section>

        {error ? <div className="mt-6 rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-50">{error}</div> : null}

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Visible users", loading ? "..." : state.userCount, "Cross-campus identity scope in the current tenant."],
            ["Fee collection", loading ? "..." : money(state.feeCollection), "A finance signal that belongs next to admin oversight."],
            ["Campuses | Programs", loading ? "..." : `${state.campusCount} | ${state.programCount}`, "Live public catalog coverage carried into the admin view."],
            ["Admissions inquiries", loading ? "..." : state.inquiryCount, "Inbound demand from the refreshed public experience."]
          ].map(([label, value, note]) => (
            <article key={label as string} className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
              <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
              <p className="mt-3 text-sm leading-6 text-fuchsia-100/90">{note}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            ["Identity audit events", loading ? "..." : state.auditCount, "Operational traceability around sessions and access changes."],
            ["Announcements", loading ? "..." : state.announcementCount, "Public and internal communication stays visible beside controls."],
            ["Admissions automation", loading ? "..." : `${state.staleAdmissions} stale | ${state.overdueReminders} overdue`, "Aging applications and reminder queues stay visible."],
            ["Facility operations", loading ? "..." : `${state.openWorkOrders} open | ${state.amcExpiring} AMC`, "Campus operations, utilities, and vendor upkeep now surface here."],
            ["Governance deadlines", loading ? "..." : `${state.complianceDeadlines} due | ${state.openLegalCases} legal`, "Accreditation, RTI, and compliance work is now visible in the admin layer."],
            ["Incubation and IRD", loading ? "..." : `${state.activeResearchProjects} projects | ${state.activeIncubations} ventures`, "Research delivery and startup mentoring no longer sit outside the ERP surface."]
          ].map(([label, value, note]) => (
            <article key={label as string} className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
              <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
              <p className="mt-3 text-sm leading-6 text-fuchsia-100/90">{note}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(7,17,31,0.82)] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">HR foundation</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : `${state.activeEmployees} employees | ${state.openRecruitment} openings`}</h2>
            <p className="mt-3 text-sm text-fuchsia-100/90">{loading ? "..." : `${state.onboardingInProgress} onboarding | ${state.appraisalsDueSoon} appraisals due | ${state.pendingLeaveRequests} leave approvals`}</p>
            <div className="mt-5 space-y-3">
              {state.leaveRequests.map((item) => (
                <div key={item.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{item.employeeName}</p>
                  <p className="mt-1 text-sm text-fuchsia-100/90">{item.leaveType} | {item.status}</p>
                  <p className="mt-1 text-xs text-slate-400">{dateLabel(item.startDateUtc)} to {dateLabel(item.endDateUtc)}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => mutate(`leave-${item.id}`, `${apiConfig.organization()}/api/v1/hr/leave-requests/${item.id}/status`, { status: "Approved", approverName: "Admin Desk", comment: "Approved from admin workspace." }, () => setState((current) => ({ ...current, pendingLeaveRequests: Math.max(0, current.pendingLeaveRequests - 1), leaveRequests: current.leaveRequests.map((leave) => leave.id === item.id ? { ...leave, status: "Approved", approverName: "Admin Desk" } : leave) })), (payload) => setState((current) => ({ ...current, pendingLeaveRequests: Math.max(0, current.pendingLeaveRequests - 1), leaveRequests: current.leaveRequests.map((leave) => leave.id === item.id ? { ...leave, ...payload } : leave) })))} disabled={updating === `leave-${item.id}` || item.status === "Approved"} className="rounded-full bg-emerald-400/20 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-50">Approve</button>
                    <button type="button" onClick={() => mutate(`opening-${item.id}`, `${apiConfig.organization()}/api/v1/hr/leave-requests/${item.id}/status`, { status: "Closed", approverName: "Admin Desk", comment: "Closed from admin workspace." }, () => setState((current) => ({ ...current, pendingLeaveRequests: Math.max(0, current.pendingLeaveRequests - (item.status.includes("Pending") ? 1 : 0)), leaveRequests: current.leaveRequests.map((leave) => leave.id === item.id ? { ...leave, status: "Closed", approverName: "Admin Desk" } : leave) })), (payload) => setState((current) => ({ ...current, pendingLeaveRequests: Math.max(0, current.pendingLeaveRequests - (item.status.includes("Pending") ? 1 : 0)), leaveRequests: current.leaveRequests.map((leave) => leave.id === item.id ? { ...leave, ...payload } : leave) })))} disabled={updating === `opening-${item.id}` || item.status === "Closed"} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Close</button>
                  </div>
                </div>
              ))}
              {state.recruitmentOpenings.map((item) => (
                <div key={item.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-fuchsia-100/90">{item.departmentName} | {item.status}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.candidatePipelineCount} candidates | {item.openPositions} openings</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => mutate(`recruit-${item.id}`, `${apiConfig.organization()}/api/v1/hr/recruitment/openings/${item.id}/status`, { status: "Interviewing", ownerName: "Admin Desk", note: "Moved to interview." }, () => setState((current) => ({ ...current, recruitmentOpenings: current.recruitmentOpenings.map((opening) => opening.id === item.id ? { ...opening, status: "Interviewing" } : opening) })), (payload) => setState((current) => ({ ...current, recruitmentOpenings: current.recruitmentOpenings.map((opening) => opening.id === item.id ? { ...opening, ...payload } : opening) })))} disabled={updating === `recruit-${item.id}` || item.status === "Interviewing"} className="rounded-full bg-sky-400/20 px-3 py-2 text-xs font-semibold text-sky-100 disabled:opacity-50">Move To Interview</button>
                    <button type="button" onClick={() => mutate(`recruit-close-${item.id}`, `${apiConfig.organization()}/api/v1/hr/recruitment/openings/${item.id}/status`, { status: "Closed", ownerName: "Admin Desk", note: "Position closed." }, () => setState((current) => ({ ...current, openRecruitment: Math.max(0, current.openRecruitment - 1), recruitmentOpenings: current.recruitmentOpenings.map((opening) => opening.id === item.id ? { ...opening, status: "Closed" } : opening) })), (payload) => setState((current) => ({ ...current, openRecruitment: Math.max(0, current.openRecruitment - 1), recruitmentOpenings: current.recruitmentOpenings.map((opening) => opening.id === item.id ? { ...opening, ...payload } : opening) })))} disabled={updating === `recruit-close-${item.id}` || item.status === "Closed"} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Close</button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(7,17,31,0.82)] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Stores and purchase</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : `${state.openRequisitions} requisitions | ${state.purchaseOrdersOpen} live POs`}</h2>
            <p className="mt-3 text-sm text-fuchsia-100/90">{loading ? "..." : `${state.pendingProcurementApproval} approvals | ${state.reorderAlerts} reorder alerts | ${money(state.monthlyCommittedSpend)} committed`}</p>
            <div className="mt-5 space-y-3">
              {state.procurementRequisitions.map((item) => (
                <div key={item.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-fuchsia-100/90">{item.departmentName} | {item.status}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.priority} priority | {money(item.amount)}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => mutate(`req-${item.id}`, `${apiConfig.finance()}/api/v1/procurement/requisitions/${item.id}/status`, { status: "Approved", actorName: "Finance Controller", note: "Approved for PO creation." }, () => setState((current) => ({ ...current, pendingProcurementApproval: Math.max(0, current.pendingProcurementApproval - (item.status.includes("Pending") ? 1 : 0)), procurementRequisitions: current.procurementRequisitions.map((request) => request.id === item.id ? { ...request, status: "Approved" } : request) })), (payload) => setState((current) => ({ ...current, pendingProcurementApproval: Math.max(0, current.pendingProcurementApproval - (item.status.includes("Pending") ? 1 : 0)), procurementRequisitions: current.procurementRequisitions.map((request) => request.id === item.id ? { ...request, ...payload } : request) })))} disabled={updating === `req-${item.id}` || item.status === "Approved"} className="rounded-full bg-emerald-400/20 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-50">Approve</button>
                    <button type="button" onClick={() => mutate(`req-back-${item.id}`, `${apiConfig.finance()}/api/v1/procurement/requisitions/${item.id}/status`, { status: "Sent Back", actorName: "Finance Controller", note: "Returned for revision." }, () => setState((current) => ({ ...current, pendingProcurementApproval: Math.max(0, current.pendingProcurementApproval - (item.status.includes("Pending") ? 1 : 0)), procurementRequisitions: current.procurementRequisitions.map((request) => request.id === item.id ? { ...request, status: "Sent Back" } : request) })), (payload) => setState((current) => ({ ...current, pendingProcurementApproval: Math.max(0, current.pendingProcurementApproval - (item.status.includes("Pending") ? 1 : 0)), procurementRequisitions: current.procurementRequisitions.map((request) => request.id === item.id ? { ...request, ...payload } : request) })))} disabled={updating === `req-back-${item.id}` || item.status === "Sent Back"} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Send Back</button>
                  </div>
                </div>
              ))}
              {state.purchaseOrders.map((item) => (
                <div key={item.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{item.orderNumber}</p>
                  <p className="mt-1 text-sm text-fuchsia-100/90">{item.vendorName} | {item.status}</p>
                  <p className="mt-1 text-xs text-slate-400">{money(item.amount)} | ETA {dateLabel(item.expectedDeliveryUtc)}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => mutate(`po-${item.id}`, `${apiConfig.finance()}/api/v1/procurement/purchase-orders/${item.id}/status`, { status: "Delivered", actorName: "Procurement Desk", note: "Delivery confirmed." }, () => setState((current) => ({ ...current, purchaseOrdersOpen: Math.max(0, current.purchaseOrdersOpen - 1), purchaseOrders: current.purchaseOrders.map((order) => order.id === item.id ? { ...order, status: "Delivered" } : order) })), (payload) => setState((current) => ({ ...current, purchaseOrdersOpen: Math.max(0, current.purchaseOrdersOpen - 1), purchaseOrders: current.purchaseOrders.map((order) => order.id === item.id ? { ...order, ...payload } : order) })))} disabled={updating === `po-${item.id}` || item.status === "Delivered"} className="rounded-full bg-cyan-400/20 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50">Mark Delivered</button>
                    <button type="button" onClick={() => mutate(`po-exp-${item.id}`, `${apiConfig.finance()}/api/v1/procurement/purchase-orders/${item.id}/status`, { status: "Expediting", actorName: "Procurement Desk", note: "Vendor dispatch follow-up." }, () => setState((current) => ({ ...current, purchaseOrders: current.purchaseOrders.map((order) => order.id === item.id ? { ...order, status: "Expediting" } : order) })), (payload) => setState((current) => ({ ...current, purchaseOrders: current.purchaseOrders.map((order) => order.id === item.id ? { ...order, ...payload } : order) })))} disabled={updating === `po-exp-${item.id}` || item.status === "Expediting"} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Expedite</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(7,17,31,0.82)] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Facility and compliance</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : `${state.openWorkOrders} work orders | ${state.complianceDeadlines} deadlines`}</h2>
            <p className="mt-3 text-sm text-fuchsia-100/90">{loading ? "..." : `${state.amcExpiring} AMC renewals | ${state.openLegalCases} RTI/legal matters still active`}</p>
            <div className="mt-5 space-y-3">
              {state.facilityWorkOrders.map((item) => (
                <div key={item.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-fuchsia-100/90">{item.category} | {item.status}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.priority} priority | {item.assignedTo} | due {dateLabel(item.dueAtUtc)}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => mutate(`facility-${item.id}`, `${apiConfig.organization()}/api/v1/facility/work-orders/${item.id}/status`, { status: "In Progress", assignedTo: item.assignedTo, note: "Escalated from admin workspace." }, () => setState((current) => ({ ...current, facilityWorkOrders: current.facilityWorkOrders.map((entry) => entry.id === item.id ? { ...entry, status: "In Progress" } : entry) })), (payload) => setState((current) => ({ ...current, facilityWorkOrders: current.facilityWorkOrders.map((entry) => entry.id === item.id ? { ...entry, ...payload } : entry) })))} disabled={updating === `facility-${item.id}` || item.status === "In Progress"} className="rounded-full bg-sky-400/20 px-3 py-2 text-xs font-semibold text-sky-100 disabled:opacity-50">Dispatch</button>
                    <button type="button" onClick={() => mutate(`facility-close-${item.id}`, `${apiConfig.organization()}/api/v1/facility/work-orders/${item.id}/status`, { status: "Completed", assignedTo: item.assignedTo, note: "Completed from admin workspace." }, () => setState((current) => ({ ...current, openWorkOrders: Math.max(0, current.openWorkOrders - 1), facilityWorkOrders: current.facilityWorkOrders.map((entry) => entry.id === item.id ? { ...entry, status: "Completed" } : entry) })), (payload) => setState((current) => ({ ...current, openWorkOrders: Math.max(0, current.openWorkOrders - 1), facilityWorkOrders: current.facilityWorkOrders.map((entry) => entry.id === item.id ? { ...entry, ...payload } : entry) })))} disabled={updating === `facility-close-${item.id}` || item.status === "Completed"} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Complete</button>
                  </div>
                </div>
              ))}
              {state.accreditationItems.map((item) => (
                <div key={item.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{item.frameworkName} | {item.cycleName}</p>
                  <p className="mt-1 text-sm text-fuchsia-100/90">{item.ownerName} | {item.status}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.evidenceCount} evidence items | due {dateLabel(item.dueAtUtc)}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => mutate(`accr-${item.id}`, `${apiConfig.organization()}/api/v1/accreditation/initiatives/${item.id}/status`, { status: "Review Pending", ownerName: item.ownerName, note: "Moved to review from admin workspace." }, () => setState((current) => ({ ...current, accreditationItems: current.accreditationItems.map((entry) => entry.id === item.id ? { ...entry, status: "Review Pending" } : entry) })), (payload) => setState((current) => ({ ...current, accreditationItems: current.accreditationItems.map((entry) => entry.id === item.id ? { ...entry, ...payload } : entry) })))} disabled={updating === `accr-${item.id}` || item.status === "Review Pending"} className="rounded-full bg-amber-300/20 px-3 py-2 text-xs font-semibold text-amber-50 disabled:opacity-50">Review</button>
                    <button type="button" onClick={() => mutate(`legal-${item.id}`, `${apiConfig.organization()}/api/v1/accreditation/initiatives/${item.id}/status`, { status: "Closed", ownerName: item.ownerName, note: "Evidence pack accepted." }, () => setState((current) => ({ ...current, complianceDeadlines: Math.max(0, current.complianceDeadlines - 1), accreditationItems: current.accreditationItems.map((entry) => entry.id === item.id ? { ...entry, status: "Closed" } : entry) })), (payload) => setState((current) => ({ ...current, complianceDeadlines: Math.max(0, current.complianceDeadlines - 1), accreditationItems: current.accreditationItems.map((entry) => entry.id === item.id ? { ...entry, ...payload } : entry) })))} disabled={updating === `legal-${item.id}` || item.status === "Closed"} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Close</button>
                  </div>
                </div>
              ))}
              {state.legalCases.map((item) => (
                <div key={item.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-fuchsia-100/90">{item.caseType} | {item.status}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.ownerName} | {item.riskLevel} risk | due {dateLabel(item.dueAtUtc)}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => mutate(`case-${item.id}`, `${apiConfig.organization()}/api/v1/legal/cases/${item.id}/status`, { status: "Counsel Review", ownerName: item.ownerName, note: "Escalated for counsel review." }, () => setState((current) => ({ ...current, legalCases: current.legalCases.map((entry) => entry.id === item.id ? { ...entry, status: "Counsel Review" } : entry) })), (payload) => setState((current) => ({ ...current, legalCases: current.legalCases.map((entry) => entry.id === item.id ? { ...entry, ...payload } : entry) })))} disabled={updating === `case-${item.id}` || item.status === "Counsel Review"} className="rounded-full bg-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-100 disabled:opacity-50">Escalate</button>
                    <button type="button" onClick={() => mutate(`case-close-${item.id}`, `${apiConfig.organization()}/api/v1/legal/cases/${item.id}/status`, { status: "Closed", ownerName: item.ownerName, note: "Closed from admin workspace." }, () => setState((current) => ({ ...current, openLegalCases: Math.max(0, current.openLegalCases - 1), legalCases: current.legalCases.map((entry) => entry.id === item.id ? { ...entry, status: "Closed" } : entry) })), (payload) => setState((current) => ({ ...current, openLegalCases: Math.max(0, current.openLegalCases - 1), legalCases: current.legalCases.map((entry) => entry.id === item.id ? { ...entry, ...payload } : entry) })))} disabled={updating === `case-close-${item.id}` || item.status === "Closed"} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Close</button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(7,17,31,0.82)] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">IRD and incubation</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : `${state.activeResearchProjects} projects | ${state.activeIncubations} ventures`}</h2>
            <p className="mt-3 text-sm text-fuchsia-100/90">{loading ? "..." : `${state.complianceDeadlines} sponsor or compliance checkpoints | institute innovation now rides the same ops surface`}</p>
            <div className="mt-5 space-y-3">
              {state.researchProjects.map((item) => (
                <div key={item.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-fuchsia-100/90">{item.departmentName} | {item.status}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.sponsorName} | {money(item.budgetAmount)} | due {dateLabel(item.milestoneDueAtUtc)}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => mutate(`project-${item.id}`, `${apiConfig.organization()}/api/v1/ird/projects/${item.id}/status`, { status: "Sponsor Review", ownerName: item.principalInvestigator, complianceStatus: item.complianceStatus, note: "Milestone pack sent." }, () => setState((current) => ({ ...current, researchProjects: current.researchProjects.map((entry) => entry.id === item.id ? { ...entry, status: "Sponsor Review" } : entry) })), (payload) => setState((current) => ({ ...current, researchProjects: current.researchProjects.map((entry) => entry.id === item.id ? { ...entry, ...payload } : entry) })))} disabled={updating === `project-${item.id}` || item.status === "Sponsor Review"} className="rounded-full bg-cyan-400/20 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50">Send Review</button>
                    <button type="button" onClick={() => mutate(`project-complete-${item.id}`, `${apiConfig.organization()}/api/v1/ird/projects/${item.id}/status`, { status: "Completed", ownerName: item.principalInvestigator, complianceStatus: "Closed", note: "Closed from admin workspace." }, () => setState((current) => ({ ...current, activeResearchProjects: Math.max(0, current.activeResearchProjects - 1), researchProjects: current.researchProjects.map((entry) => entry.id === item.id ? { ...entry, status: "Completed", complianceStatus: "Closed" } : entry) })), (payload) => setState((current) => ({ ...current, activeResearchProjects: Math.max(0, current.activeResearchProjects - 1), researchProjects: current.researchProjects.map((entry) => entry.id === item.id ? { ...entry, ...payload } : entry) })))} disabled={updating === `project-complete-${item.id}` || item.status === "Completed"} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Close</button>
                  </div>
                </div>
              ))}
              {state.incubationStartups.map((item) => (
                <div key={item.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{item.startupName}</p>
                  <p className="mt-1 text-sm text-fuchsia-100/90">{item.cohortName} | {item.status}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.mentorName} | {item.fundingStage} | review {dateLabel(item.reviewDueAtUtc)}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => mutate(`startup-${item.id}`, `${apiConfig.organization()}/api/v1/incubation/startups/${item.id}/status`, { status: "Investor Readiness", mentorName: item.mentorName, note: "Moved to investor readiness." }, () => setState((current) => ({ ...current, incubationStartups: current.incubationStartups.map((entry) => entry.id === item.id ? { ...entry, status: "Investor Readiness" } : entry) })), (payload) => setState((current) => ({ ...current, incubationStartups: current.incubationStartups.map((entry) => entry.id === item.id ? { ...entry, ...payload } : entry) })))} disabled={updating === `startup-${item.id}` || item.status === "Investor Readiness"} className="rounded-full bg-violet-400/20 px-3 py-2 text-xs font-semibold text-violet-100 disabled:opacity-50">Advance</button>
                    <button type="button" onClick={() => mutate(`startup-graduate-${item.id}`, `${apiConfig.organization()}/api/v1/incubation/startups/${item.id}/status`, { status: "Graduated", mentorName: item.mentorName, note: "Graduated from cohort." }, () => setState((current) => ({ ...current, activeIncubations: Math.max(0, current.activeIncubations - 1), incubationStartups: current.incubationStartups.map((entry) => entry.id === item.id ? { ...entry, status: "Graduated" } : entry) })), (payload) => setState((current) => ({ ...current, activeIncubations: Math.max(0, current.activeIncubations - 1), incubationStartups: current.incubationStartups.map((entry) => entry.id === item.id ? { ...entry, ...payload } : entry) })))} disabled={updating === `startup-graduate-${item.id}` || item.status === "Graduated"} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Graduate</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

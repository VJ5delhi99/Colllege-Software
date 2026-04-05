import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { AnimatedSurface } from "../components/AnimatedSurface";
import { getStudentSession } from "./auth-client";
import { apiConfig } from "./api-config";
import { isDemoModeEnabled } from "./demo-mode";

type FollowUpItem = {
  id: string;
  applicantName: string;
  label: string;
  meta: string;
};

type StudentRequestItem = {
  id: string;
  title: string;
  requestType: string;
  status: string;
  assignedTo?: string;
  fulfillmentReference?: string;
  studentId?: string;
};

type FacilityWorkOrderItem = {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  assignedTo: string;
  dueAtUtc: string;
};

type ResearchProjectItem = {
  id: string;
  title: string;
  status: string;
  principalInvestigator: string;
  complianceStatus: string;
  milestoneDueAtUtc: string;
};

type LegalCaseItem = {
  id: string;
  title: string;
  caseType: string;
  status: string;
  ownerName: string;
  dueAtUtc: string;
};

type IncubationStartupItem = {
  id: string;
  startupName: string;
  status: string;
  mentorName: string;
  reviewDueAtUtc: string;
};

type EstateContractItem = {
  id: string;
  contractType: string;
  title: string;
  status: string;
  vendorName: string;
  ownerName: string;
  renewalDueAtUtc: string;
  valueAmount: number;
};

type PlanningInitiativeItem = {
  id: string;
  initiativeName: string;
  category: string;
  status: string;
  ownerName: string;
  milestoneName: string;
  dueAtUtc: string;
  budgetAmount: number;
};

type ResourceCampaignItem = {
  id: string;
  campaignName: string;
  sourceType: string;
  status: string;
  ownerName: string;
  targetAmount: number;
  securedAmount: number;
  reviewDueAtUtc: string;
};

type AdminState = {
  campuses: number;
  programs: number;
  inquiries: number;
  applications: number;
  pendingDocs: number;
  communications: number;
  openReminders: number;
  feeCollection: number;
  activeEmployees: number;
  pendingLeaveRequests: number;
  openRecruitment: number;
  pendingProcurementApproval: number;
  reorderAlerts: number;
  monthlyCommittedSpend: number;
  openWorkOrders: number;
  complianceDeadlines: number;
  openLegalCases: number;
  activeResearchProjects: number;
  activeIncubations: number;
  contractRenewalsDue: number;
  planningMilestonesDue: number;
  activeResourceCampaigns: number;
  followUps: FollowUpItem[];
  studentRequests: StudentRequestItem[];
  facilityWorkOrders: FacilityWorkOrderItem[];
  researchProjects: ResearchProjectItem[];
  legalCases: LegalCaseItem[];
  incubationStartups: IncubationStartupItem[];
  estateContracts: EstateContractItem[];
  planningInitiatives: PlanningInitiativeItem[];
  resourceCampaigns: ResourceCampaignItem[];
  error: string | null;
};

const demoState: AdminState = {
  campuses: 3,
  programs: 6,
  inquiries: 2,
  applications: 2,
  pendingDocs: 1,
  communications: 1,
  openReminders: 1,
  feeCollection: 57000,
  activeEmployees: 3,
  pendingLeaveRequests: 1,
  openRecruitment: 2,
  pendingProcurementApproval: 1,
  reorderAlerts: 1,
  monthlyCommittedSpend: 309000,
  openWorkOrders: 2,
  complianceDeadlines: 3,
  openLegalCases: 2,
  activeResearchProjects: 2,
  activeIncubations: 2,
  contractRenewalsDue: 1,
  planningMilestonesDue: 1,
  activeResourceCampaigns: 2,
  followUps: [
    {
      id: "communication-1",
      applicantName: "Riya Menon",
      label: "Email follow-up sent",
      meta: "Application Follow-Up | Sent today"
    },
    {
      id: "reminder-1",
      applicantName: "Riya Menon",
      label: "Document follow-up reminder",
      meta: "Open until tomorrow 09:00"
    }
  ],
  studentRequests: [
    {
      id: "request-1",
      title: "Need bonafide letter for internship verification",
      requestType: "Bonafide Letter",
      status: "Submitted",
      assignedTo: "Student Services Desk",
      studentId: "00000000-0000-0000-0000-000000000123"
    },
    {
      id: "request-2",
      title: "Official transcript for graduate application",
      requestType: "Transcript Certificate",
      status: "Approved",
      assignedTo: "Examination Cell",
      fulfillmentReference: "CERT-2026-1004",
      studentId: "00000000-0000-0000-0000-000000000123"
    }
  ],
  facilityWorkOrders: [
    {
      id: "facility-1",
      title: "Chiller plant preventive maintenance",
      category: "Utilities",
      status: "Scheduled",
      priority: "High",
      assignedTo: "Campus Engineering",
      dueAtUtc: new Date(Date.now() + 3 * 86400000).toISOString()
    }
  ],
  researchProjects: [
    {
      id: "project-1",
      title: "AI-enabled crop resilience platform",
      status: "Active",
      principalInvestigator: "Dr. Priya Menon",
      complianceStatus: "Report Due",
      milestoneDueAtUtc: new Date(Date.now() + 10 * 86400000).toISOString()
    }
  ],
  legalCases: [
    {
      id: "case-1",
      title: "Scholarship allocation disclosure request",
      caseType: "RTI",
      status: "Response Drafting",
      ownerName: "Registrar Office",
      dueAtUtc: new Date(Date.now() + 4 * 86400000).toISOString()
    }
  ],
  incubationStartups: [
    {
      id: "startup-1",
      startupName: "CircuitNest",
      status: "Mentoring",
      mentorName: "Prof. Rohan Iyer",
      reviewDueAtUtc: new Date(Date.now() + 6 * 86400000).toISOString()
    }
  ],
  estateContracts: [
    {
      id: "contract-1",
      contractType: "Annual Maintenance Contract",
      title: "North Campus HVAC AMC",
      status: "Renewal Review",
      vendorName: "ThermoServe Engineering",
      ownerName: "Campus Engineering",
      renewalDueAtUtc: new Date(Date.now() + 14 * 86400000).toISOString(),
      valueAmount: 1850000
    }
  ],
  planningInitiatives: [
    {
      id: "planning-1",
      initiativeName: "Engineering block capacity expansion",
      category: "Capital Planning",
      status: "Board Review",
      ownerName: "Registrar Office",
      milestoneName: "Final concept approval",
      dueAtUtc: new Date(Date.now() + 12 * 86400000).toISOString(),
      budgetAmount: 14500000
    }
  ],
  resourceCampaigns: [
    {
      id: "campaign-1",
      campaignName: "Industry chair endowment drive",
      sourceType: "Corporate CSR",
      status: "Prospect Outreach",
      ownerName: "Development Office",
      targetAmount: 30000000,
      securedAmount: 8500000,
      reviewDueAtUtc: new Date(Date.now() + 9 * 86400000).toISOString()
    }
  ],
  error: null
};

function formatMoney(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

export default function AdminMobilePage() {
  const [state, setState] = useState<AdminState>(demoState);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const demoMode = isDemoModeEnabled();

  useEffect(() => {
    if (demoMode) {
      setState(demoState);
      return;
    }

    getStudentSession()
      .then(async (session) => {
        const headers = {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        };
        const [organizationResponse, admissionsResponse, communicationsResponse, remindersResponse, requestsResponse, financeResponse, hrSummaryResponse, procurementSummaryResponse, governanceResponse, facilityResponse, researchResponse, legalResponse, incubationResponse, contractsResponse, planningResponse, campaignsResponse] = await Promise.all([
          fetch(`${apiConfig.organization()}/api/v1/catalog/summary`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/admissions/summary`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/admissions/communications?pageSize=3`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/admissions/reminders?pageSize=3`, { headers }),
          fetch(`${apiConfig.student()}/api/v1/requests?pageSize=3`, { headers }),
          fetch(`${apiConfig.finance()}/api/v1/payments/summary`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/hr/summary`, { headers }),
          fetch(`${apiConfig.finance()}/api/v1/procurement/summary`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/governance/summary`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/facility/work-orders?pageSize=2`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/ird/projects?pageSize=2`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/legal/cases?pageSize=2`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/incubation/startups?pageSize=2`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/estate/contracts?pageSize=2`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/planning/initiatives?pageSize=2`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/resource-generation/campaigns?pageSize=2`, { headers })
        ]);

        if (!organizationResponse.ok || !admissionsResponse.ok || !communicationsResponse.ok || !remindersResponse.ok || !requestsResponse.ok || !financeResponse.ok || !hrSummaryResponse.ok || !procurementSummaryResponse.ok || !governanceResponse.ok || !facilityResponse.ok || !researchResponse.ok || !legalResponse.ok || !incubationResponse.ok || !contractsResponse.ok || !planningResponse.ok || !campaignsResponse.ok) {
          throw new Error("Admin mobile workspace is unavailable.");
        }

        const [organization, admissions, communicationsPayload, remindersPayload, requestsPayload, finance, hrSummary, procurementSummary, governanceSummary, facilityPayload, researchPayload, legalPayload, incubationPayload, contractsPayload, planningPayload, campaignsPayload] = await Promise.all([
          organizationResponse.json(),
          admissionsResponse.json(),
          communicationsResponse.json(),
          remindersResponse.json(),
          requestsResponse.json(),
          financeResponse.json(),
          hrSummaryResponse.json(),
          procurementSummaryResponse.json(),
          governanceResponse.json(),
          facilityResponse.json(),
          researchResponse.json(),
          legalResponse.json(),
          incubationResponse.json(),
          contractsResponse.json(),
          planningResponse.json(),
          campaignsResponse.json()
        ]);
        const followUps: FollowUpItem[] = [
          ...((communicationsPayload?.items ?? []) as Array<{ id: string; applicantName: string; subject: string; channel: string; status: string }>).map((item) => ({
            id: item.id,
            applicantName: item.applicantName,
            label: item.subject,
            meta: `${item.channel} | ${item.status}`
          })),
          ...((remindersPayload?.items ?? []) as Array<{ id: string; applicantName: string; reminderType: string; status: string; dueAtUtc: string }>).map((item) => ({
            id: item.id,
            applicantName: item.applicantName,
            label: item.reminderType,
            meta: `${item.status} | ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(item.dueAtUtc))}`
          }))
        ].slice(0, 4);
        setState({
          campuses: organization?.campuses ?? 0,
          programs: organization?.programs ?? 0,
          inquiries: admissions?.total ?? 0,
          applications: admissions?.applications?.total ?? 0,
          pendingDocs: admissions?.documents?.pending ?? 0,
          communications: admissions?.communications?.total ?? 0,
          openReminders: admissions?.reminders?.open ?? 0,
          feeCollection: finance?.totalCollected ?? 0,
          activeEmployees: hrSummary?.activeEmployees ?? 0,
          pendingLeaveRequests: hrSummary?.pendingLeaveRequests ?? 0,
          openRecruitment: hrSummary?.openRecruitment ?? 0,
          pendingProcurementApproval: procurementSummary?.pendingApproval ?? 0,
          reorderAlerts: procurementSummary?.reorderAlerts ?? 0,
          monthlyCommittedSpend: procurementSummary?.monthlyCommittedSpend ?? 0,
          openWorkOrders: governanceSummary?.openWorkOrders ?? 0,
          complianceDeadlines: governanceSummary?.complianceDeadlines ?? 0,
          openLegalCases: governanceSummary?.openRtiCases ?? 0,
          activeResearchProjects: governanceSummary?.activeProjects ?? 0,
          activeIncubations: governanceSummary?.activeIncubations ?? 0,
          contractRenewalsDue: governanceSummary?.contractRenewalsDue ?? 0,
          planningMilestonesDue: governanceSummary?.planningMilestonesDue ?? 0,
          activeResourceCampaigns: governanceSummary?.activeResourceCampaigns ?? 0,
          followUps,
          studentRequests: requestsPayload?.items ?? [],
          facilityWorkOrders: facilityPayload?.items ?? [],
          researchProjects: researchPayload?.items ?? [],
          legalCases: legalPayload?.items ?? [],
          incubationStartups: incubationPayload?.items ?? [],
          estateContracts: contractsPayload?.items ?? [],
          planningInitiatives: planningPayload?.items ?? [],
          resourceCampaigns: campaignsPayload?.items ?? [],
          error: null
        });
      })
      .catch(() => {
        setState((current) => ({
          ...current,
          error: "Admin mobile workspace needs an admin session or demo mode."
        }));
      });
  }, [demoMode]);

  const cards = [
    { label: "Campuses", value: state.campuses.toString() },
    { label: "Programs", value: state.programs.toString() },
    { label: "Inquiries", value: state.inquiries.toString() },
    { label: "Applications", value: state.applications.toString() },
    { label: "Leave Approvals", value: state.pendingLeaveRequests.toString() },
    { label: "Recruitment", value: state.openRecruitment.toString() },
    { label: "Procurement", value: state.pendingProcurementApproval.toString() },
    { label: "Reorder Alerts", value: state.reorderAlerts.toString() },
    { label: "Facility", value: state.openWorkOrders.toString() },
    { label: "Compliance", value: state.complianceDeadlines.toString() },
    { label: "Legal", value: state.openLegalCases.toString() },
    { label: "Incubation", value: state.activeIncubations.toString() },
    { label: "Contracts", value: state.contractRenewalsDue.toString() },
    { label: "Planning", value: state.planningMilestonesDue.toString() }
  ];

  async function updateStudentRequestStatus(item: StudentRequestItem, status: string) {
    setUpdatingRequestId(item.id);

    try {
      if (demoMode) {
        setState((current) => ({
          ...current,
          studentRequests: current.studentRequests.map((request) =>
            request.id === item.id
              ? {
                  ...request,
                  status,
                  fulfillmentReference: status === "Fulfilled" ? request.fulfillmentReference ?? "CERT-DEMO-1001" : request.fulfillmentReference
                }
              : request
          )
        }));
        return;
      }

      const session = await getStudentSession();
      const response = await fetch(`${apiConfig.student()}/api/v1/requests/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          assignedTo: item.assignedTo ?? "Student Services Desk",
          resolutionNote: status === "Approved" ? "Approved for processing from mobile admin." : "Fulfilled from the mobile admin workspace.",
          fulfillmentReference: status === "Fulfilled" ? item.fulfillmentReference ?? `CERT-${new Date().getFullYear()}-2001` : item.fulfillmentReference
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update student request.");
      }

      const payload = (await response.json()) as StudentRequestItem;
      setState((current) => ({
        ...current,
        studentRequests: current.studentRequests.map((request) => (request.id === item.id ? { ...request, ...payload } : request))
      }));
    } catch {
      setState((current) => ({
        ...current,
        error: "Student request approval is unavailable right now."
      }));
    } finally {
      setUpdatingRequestId(null);
    }
  }

  async function updateGovernanceStatus(kind: "facility" | "project" | "legal" | "startup" | "contract" | "planning" | "campaign", id: string, status: string) {
    try {
      if (demoMode) {
        setState((current) => ({
          ...current,
          facilityWorkOrders: kind === "facility" ? current.facilityWorkOrders.map((item) => (item.id === id ? { ...item, status } : item)) : current.facilityWorkOrders,
          researchProjects: kind === "project" ? current.researchProjects.map((item) => (item.id === id ? { ...item, status } : item)) : current.researchProjects,
          legalCases: kind === "legal" ? current.legalCases.map((item) => (item.id === id ? { ...item, status } : item)) : current.legalCases,
          incubationStartups: kind === "startup" ? current.incubationStartups.map((item) => (item.id === id ? { ...item, status } : item)) : current.incubationStartups,
          estateContracts: kind === "contract" ? current.estateContracts.map((item) => (item.id === id ? { ...item, status } : item)) : current.estateContracts,
          planningInitiatives: kind === "planning" ? current.planningInitiatives.map((item) => (item.id === id ? { ...item, status } : item)) : current.planningInitiatives,
          resourceCampaigns: kind === "campaign" ? current.resourceCampaigns.map((item) => (item.id === id ? { ...item, status } : item)) : current.resourceCampaigns
        }));
        return;
      }

      const session = await getStudentSession();
      const url =
        kind === "facility"
          ? `${apiConfig.organization()}/api/v1/facility/work-orders/${id}/status`
          : kind === "project"
            ? `${apiConfig.organization()}/api/v1/ird/projects/${id}/status`
            : kind === "legal"
              ? `${apiConfig.organization()}/api/v1/legal/cases/${id}/status`
              : kind === "startup"
                ? `${apiConfig.organization()}/api/v1/incubation/startups/${id}/status`
                : kind === "contract"
                  ? `${apiConfig.organization()}/api/v1/estate/contracts/${id}/status`
                  : kind === "planning"
                    ? `${apiConfig.organization()}/api/v1/planning/initiatives/${id}/status`
                    : `${apiConfig.organization()}/api/v1/resource-generation/campaigns/${id}/status`;

      const body =
        kind === "facility"
          ? { status, assignedTo: "Mobile Ops Desk", note: "Updated from admin mobile." }
          : kind === "project"
            ? { status, ownerName: "Mobile Governance Desk", complianceStatus: status === "Completed" ? "Closed" : "Report Due", note: "Updated from admin mobile." }
            : kind === "legal"
              ? { status, ownerName: "Mobile Governance Desk", note: "Updated from admin mobile." }
              : kind === "startup"
                ? { status, mentorName: "Mobile Incubation Desk", note: "Updated from admin mobile." }
                : { status, ownerName: "Mobile Governance Desk", note: "Updated from admin mobile." };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error("Unable to update governance item.");
      }

      const payload = await response.json();
      setState((current) => ({
        ...current,
        facilityWorkOrders: kind === "facility" ? current.facilityWorkOrders.map((item) => (item.id === id ? { ...item, ...payload } : item)) : current.facilityWorkOrders,
        researchProjects: kind === "project" ? current.researchProjects.map((item) => (item.id === id ? { ...item, ...payload } : item)) : current.researchProjects,
        legalCases: kind === "legal" ? current.legalCases.map((item) => (item.id === id ? { ...item, ...payload } : item)) : current.legalCases,
        incubationStartups: kind === "startup" ? current.incubationStartups.map((item) => (item.id === id ? { ...item, ...payload } : item)) : current.incubationStartups,
        estateContracts: kind === "contract" ? current.estateContracts.map((item) => (item.id === id ? { ...item, ...payload } : item)) : current.estateContracts,
        planningInitiatives: kind === "planning" ? current.planningInitiatives.map((item) => (item.id === id ? { ...item, ...payload } : item)) : current.planningInitiatives,
        resourceCampaigns: kind === "campaign" ? current.resourceCampaigns.map((item) => (item.id === id ? { ...item, ...payload } : item)) : current.resourceCampaigns
      }));
    } catch {
      setState((current) => ({
        ...current,
        error: "Governance update is unavailable right now."
      }));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#07111f" }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ color: "#c7d2fe", fontSize: 30, fontWeight: "700" }}>Admin Mobile</Text>
        <Text style={{ color: "#9fb0c7", fontSize: 15 }}>Catalog coverage, admissions load, and finance posture</Text>

        {state.error ? (
          <View style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(245, 158, 11, 0.14)", borderWidth: 1, borderColor: "rgba(245, 158, 11, 0.25)" }}>
            <Text style={{ color: "#fde68a" }}>{state.error}</Text>
          </View>
        ) : null}

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(217, 70, 239, 0.14)", borderWidth: 1, borderColor: "rgba(244, 114, 182, 0.18)" }}
        >
          <Text style={{ color: "#f5d0fe", fontSize: 13 }}>Executive Summary</Text>
          <Text style={{ color: "#fff7ed", fontSize: 22, fontWeight: "700", marginTop: 8 }}>Fee collection {formatMoney(state.feeCollection)}</Text>
          <Text style={{ color: "#fbcfe8", marginTop: 10 }}>
            {state.pendingDocs} applicant documents, {state.pendingLeaveRequests} HR approvals, and {state.pendingProcurementApproval} procurement approvals still need action.
          </Text>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 220, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(125, 211, 252, 0.12)", borderWidth: 1, borderColor: "rgba(125, 211, 252, 0.18)" }}
        >
          <Text style={{ color: "#dbeafe", fontSize: 13 }}>HR and Procurement</Text>
          <Text style={{ color: "#fff7ed", fontSize: 20, fontWeight: "700", marginTop: 8 }}>{state.activeEmployees} active employees | {formatMoney(state.monthlyCommittedSpend)} committed</Text>
          <Text style={{ color: "#bfdbfe", marginTop: 10 }}>
            Recruitment openings: {state.openRecruitment}. Reorder alerts: {state.reorderAlerts}. This mobile view now carries the same new ERP modules as the web admin surface.
          </Text>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 260, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(34, 197, 94, 0.10)", borderWidth: 1, borderColor: "rgba(134, 239, 172, 0.18)" }}
        >
          <Text style={{ color: "#dcfce7", fontSize: 13 }}>Governance and Infrastructure</Text>
          <Text style={{ color: "#fff7ed", fontSize: 20, fontWeight: "700", marginTop: 8 }}>{state.openWorkOrders} facility items | {state.activeResearchProjects} IRD projects</Text>
          <Text style={{ color: "#bbf7d0", marginTop: 10 }}>
            {state.complianceDeadlines} compliance deadlines, {state.openLegalCases} legal or RTI matters, and {state.activeIncubations} incubation ventures are now visible on mobile too.
          </Text>
        </AnimatedSurface>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {cards.map((card, index) => (
            <AnimatedSurface
              key={card.label}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 80 + index * 60, type: "timing", duration: 450 }}
              style={{ width: "48%", borderRadius: 22, padding: 18, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
            >
              <Text style={{ color: "#dbeafe", fontSize: 14 }}>{card.label}</Text>
              <Text style={{ color: "white", marginTop: 8, fontSize: 22, fontWeight: "700" }}>{card.value}</Text>
            </AnimatedSurface>
          ))}
        </View>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 320, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Text style={{ color: "#f5d0fe", fontSize: 13 }}>Recent Follow-Up Activity</Text>
          <View style={{ marginTop: 14, gap: 12 }}>
            {state.followUps.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>{item.applicantName}</Text>
                <Text style={{ color: "#fbcfe8", marginTop: 6 }}>{item.label}</Text>
                <Text style={{ color: "#d8b4fe", marginTop: 8, fontSize: 12 }}>{item.meta}</Text>
              </View>
            ))}
            {state.followUps.length === 0 ? (
              <View style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>No follow-up activity yet</Text>
                <Text style={{ color: "#d8b4fe", marginTop: 6 }}>Admissions communication and reminders will appear here once the queue starts moving.</Text>
              </View>
            ) : null}
          </View>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 380, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Text style={{ color: "#f5d0fe", fontSize: 13 }}>Student Request Fulfillment</Text>
          <View style={{ marginTop: 14, gap: 12 }}>
            {state.studentRequests.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: "#fbcfe8", marginTop: 6 }}>{item.requestType} | {item.status}</Text>
                {item.fulfillmentReference ? <Text style={{ color: "#d8b4fe", marginTop: 8, fontSize: 12 }}>Reference {item.fulfillmentReference}</Text> : null}
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  <Pressable
                    onPress={() => updateStudentRequestStatus(item, "Approved")}
                    disabled={updatingRequestId === item.id || item.status === "Approved" || item.status === "Fulfilled"}
                    style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(125, 211, 252, 0.16)", paddingHorizontal: 12, paddingVertical: 12, opacity: updatingRequestId === item.id || item.status === "Approved" || item.status === "Fulfilled" ? 0.5 : 1 }}
                  >
                    <Text style={{ color: "#cffafe", fontWeight: "700", textAlign: "center" }}>{updatingRequestId === item.id ? "Working..." : "Approve"}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateStudentRequestStatus(item, "Fulfilled")}
                    disabled={updatingRequestId === item.id || item.status === "Fulfilled"}
                    style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(187, 247, 208, 0.16)", paddingHorizontal: 12, paddingVertical: 12, opacity: updatingRequestId === item.id || item.status === "Fulfilled" ? 0.5 : 1 }}
                  >
                    <Text style={{ color: "#dcfce7", fontWeight: "700", textAlign: "center" }}>{updatingRequestId === item.id ? "Working..." : "Fulfill"}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {state.studentRequests.length === 0 ? (
              <View style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>No student requests pending</Text>
                <Text style={{ color: "#d8b4fe", marginTop: 6 }}>Certificate and service approvals will appear here once students raise them.</Text>
              </View>
            ) : null}
          </View>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 440, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Text style={{ color: "#f5d0fe", fontSize: 13 }}>Governance Queues</Text>
          <View style={{ marginTop: 14, gap: 12 }}>
            {state.facilityWorkOrders.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: "#fbcfe8", marginTop: 6 }}>{item.category} | {item.status}</Text>
                <Text style={{ color: "#d8b4fe", marginTop: 8, fontSize: 12 }}>{item.priority} priority | due {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(item.dueAtUtc))}</Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  <Pressable onPress={() => updateGovernanceStatus("facility", item.id, "In Progress")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(125, 211, 252, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#cffafe", fontWeight: "700", textAlign: "center" }}>Dispatch</Text>
                  </Pressable>
                  <Pressable onPress={() => updateGovernanceStatus("facility", item.id, "Completed")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(187, 247, 208, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#dcfce7", fontWeight: "700", textAlign: "center" }}>Complete</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {state.researchProjects.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: "#fbcfe8", marginTop: 6 }}>{item.status} | {item.principalInvestigator}</Text>
                <Text style={{ color: "#d8b4fe", marginTop: 8, fontSize: 12 }}>{item.complianceStatus} | milestone {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(item.milestoneDueAtUtc))}</Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  <Pressable onPress={() => updateGovernanceStatus("project", item.id, "Sponsor Review")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(125, 211, 252, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#cffafe", fontWeight: "700", textAlign: "center" }}>Review</Text>
                  </Pressable>
                  <Pressable onPress={() => updateGovernanceStatus("project", item.id, "Completed")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(187, 247, 208, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#dcfce7", fontWeight: "700", textAlign: "center" }}>Close</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {state.legalCases.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: "#fbcfe8", marginTop: 6 }}>{item.caseType} | {item.status}</Text>
                <Text style={{ color: "#d8b4fe", marginTop: 8, fontSize: 12 }}>{item.ownerName} | due {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(item.dueAtUtc))}</Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  <Pressable onPress={() => updateGovernanceStatus("legal", item.id, "Counsel Review")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(251, 113, 133, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#fecdd3", fontWeight: "700", textAlign: "center" }}>Escalate</Text>
                  </Pressable>
                  <Pressable onPress={() => updateGovernanceStatus("legal", item.id, "Closed")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(187, 247, 208, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#dcfce7", fontWeight: "700", textAlign: "center" }}>Close</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {state.incubationStartups.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>{item.startupName}</Text>
                <Text style={{ color: "#fbcfe8", marginTop: 6 }}>{item.mentorName} | {item.status}</Text>
                <Text style={{ color: "#d8b4fe", marginTop: 8, fontSize: 12 }}>Review {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(item.reviewDueAtUtc))}</Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  <Pressable onPress={() => updateGovernanceStatus("startup", item.id, "Investor Readiness")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(167, 139, 250, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#ddd6fe", fontWeight: "700", textAlign: "center" }}>Advance</Text>
                  </Pressable>
                  <Pressable onPress={() => updateGovernanceStatus("startup", item.id, "Graduated")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(187, 247, 208, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#dcfce7", fontWeight: "700", textAlign: "center" }}>Graduate</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 500, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(59, 130, 246, 0.10)", borderWidth: 1, borderColor: "rgba(147, 197, 253, 0.18)" }}
        >
          <Text style={{ color: "#bfdbfe", fontSize: 13 }}>Estate, Planning, and Growth</Text>
          <Text style={{ color: "#fff7ed", fontSize: 20, fontWeight: "700", marginTop: 8 }}>
            {state.contractRenewalsDue} contract renewals | {state.planningMilestonesDue} milestones
          </Text>
          <Text style={{ color: "#dbeafe", marginTop: 10 }}>
            {state.activeResourceCampaigns} active growth campaigns are now visible in the mobile admin view.
          </Text>
          <View style={{ marginTop: 14, gap: 12 }}>
            {state.estateContracts.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: "#bfdbfe", marginTop: 6 }}>{item.contractType} | {item.status}</Text>
                <Text style={{ color: "#d8b4fe", marginTop: 8, fontSize: 12 }}>{formatMoney(item.valueAmount)} | renewal {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(item.renewalDueAtUtc))}</Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  <Pressable onPress={() => updateGovernanceStatus("contract", item.id, "Renewal Review")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(250, 204, 21, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#fef3c7", fontWeight: "700", textAlign: "center" }}>Review</Text>
                  </Pressable>
                  <Pressable onPress={() => updateGovernanceStatus("contract", item.id, "Active")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(187, 247, 208, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#dcfce7", fontWeight: "700", textAlign: "center" }}>Activate</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {state.planningInitiatives.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>{item.initiativeName}</Text>
                <Text style={{ color: "#bfdbfe", marginTop: 6 }}>{item.category} | {item.status}</Text>
                <Text style={{ color: "#d8b4fe", marginTop: 8, fontSize: 12 }}>{item.milestoneName} | {formatMoney(item.budgetAmount)}</Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  <Pressable onPress={() => updateGovernanceStatus("planning", item.id, "Board Review")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(125, 211, 252, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#cffafe", fontWeight: "700", textAlign: "center" }}>Review</Text>
                  </Pressable>
                  <Pressable onPress={() => updateGovernanceStatus("planning", item.id, "Closed")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(187, 247, 208, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#dcfce7", fontWeight: "700", textAlign: "center" }}>Close</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {state.resourceCampaigns.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#fff7ed", fontSize: 16, fontWeight: "700" }}>{item.campaignName}</Text>
                <Text style={{ color: "#bfdbfe", marginTop: 6 }}>{item.sourceType} | {item.status}</Text>
                <Text style={{ color: "#d8b4fe", marginTop: 8, fontSize: 12 }}>{formatMoney(item.securedAmount)} of {formatMoney(item.targetAmount)}</Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  <Pressable onPress={() => updateGovernanceStatus("campaign", item.id, "Active")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(52, 211, 153, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#d1fae5", fontWeight: "700", textAlign: "center" }}>Activate</Text>
                  </Pressable>
                  <Pressable onPress={() => updateGovernanceStatus("campaign", item.id, "Closed")} style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(187, 247, 208, 0.16)", paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "#dcfce7", fontWeight: "700", textAlign: "center" }}>Close</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </AnimatedSurface>
      </ScrollView>
    </SafeAreaView>
  );
}

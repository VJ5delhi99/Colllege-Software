"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiConfig } from "../api-config";
import { getAdminSession, logoutAdmin } from "../auth-client";
import { isDemoModeEnabled } from "../demo-mode";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  audience: string;
  source: string;
  createdAtUtc: string;
};

type AuditLogItem = {
  id: string;
  action: string;
  entityId: string;
  actor: string;
  details: string;
  createdAtUtc: string;
};

type InquiryItem = {
  id: string;
  fullName: string;
  email: string;
  preferredCampus: string;
  interestedProgram: string;
  status: string;
  assignedTo: string;
  createdAtUtc: string;
};

type InquirySummary = {
  total: number;
  newItems: number;
  inReview: number;
  latest?: InquiryItem | null;
  applications?: {
    total: number;
    submitted: number;
    underReview: number;
    qualified: number;
    offered: number;
  };
  counseling?: {
    total: number;
    scheduled: number;
    completed: number;
  };
  documents?: {
    total: number;
    pending: number;
    verified: number;
  };
  communications?: {
    total: number;
    email: number;
    sms: number;
    sent: number;
  };
  reminders?: {
    total: number;
    open: number;
    completed: number;
  };
};

type ApplicationItem = {
  id: string;
  applicationNumber: string;
  applicantName: string;
  email: string;
  campusName: string;
  programName: string;
  stage: string;
  status: string;
  assignedTo: string;
  createdAtUtc: string;
};

type CounselingSessionItem = {
  id: string;
  applicationId: string;
  applicantName: string;
  programName: string;
  campusName: string;
  counselorName: string;
  scheduledAtUtc: string;
  modality: string;
  status: string;
  notes: string;
};

type PendingDocumentItem = {
  id: string;
  applicationId: string;
  applicantName: string;
  documentType: string;
  status: string;
  notes: string;
  fileName?: string;
  contentType?: string;
  deliveryChannel?: string;
  deliveryReference?: string;
  requestedAtUtc: string;
  uploadedAtUtc?: string | null;
  deliveredAtUtc?: string | null;
};

type CommunicationItem = {
  id: string;
  applicationId: string;
  applicantName: string;
  channel: string;
  templateName: string;
  subject: string;
  body: string;
  status: string;
  createdAtUtc: string;
};

type ReminderItem = {
  id: string;
  applicationId: string;
  applicantName: string;
  reminderType: string;
  dueAtUtc: string;
  status: string;
  notes: string;
};

type JourneyTemplateItem = {
  id: string;
  templateName: string;
  triggerType: string;
  channel: string;
  subject: string;
  isActive: boolean;
};

type CounselorWorkloadItem = {
  counselorName: string;
  activeApplications: number;
  scheduledSessions: number;
  followUpsDue: number;
  totalLoad: number;
  loadStatus: string;
};

type HelpdeskSummary = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  highPriority: number;
};

type HelpdeskTicketItem = {
  id: string;
  requesterName: string;
  requesterRole: string;
  department: string;
  category: string;
  title: string;
  priority: string;
  status: string;
  assignedTo: string;
  resolutionNote?: string;
  createdAtUtc: string;
};

async function loadOptionalJson(url: string, headers: HeadersInit, enabled: boolean) {
  if (!enabled) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 1500);
    const response = await fetch(url, { headers, signal: controller.signal }).finally(() => window.clearTimeout(timeoutId));
    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

const demoNotifications: NotificationItem[] = [
  {
    id: "notification-1",
    title: "Mid-semester review schedule released",
    message: "The principal office has published the mid-semester review schedule for every department.",
    audience: "All",
    source: "announcement",
    createdAtUtc: "2026-03-29T08:00:00Z"
  },
  {
    id: "notification-2",
    title: "New admissions inquiry from Riya Menon",
    message: "B.Tech Computer Science and Engineering | North City Campus",
    audience: "Admin",
    source: "admissions",
    createdAtUtc: "2026-03-29T11:30:00Z"
  }
];

const demoAuditLogs: AuditLogItem[] = [
  {
    id: "audit-1",
    action: "announcement.created",
    entityId: "announcement-101",
    actor: "Principal",
    details: "Mid-semester review schedule released",
    createdAtUtc: "2026-03-29T08:00:00Z"
  },
  {
    id: "audit-2",
    action: "admissions.inquiry.created",
    entityId: "inquiry-402",
    actor: "riya.menon@example.com",
    details: "Riya Menon requested B.Tech Computer Science and Engineering (North City Campus)",
    createdAtUtc: "2026-03-29T11:30:00Z"
  }
];

const demoInquiries: InquiryItem[] = [
  {
    id: "inquiry-1",
    fullName: "Riya Menon",
    email: "riya.menon@example.com",
    preferredCampus: "North City Campus",
    interestedProgram: "B.Tech Computer Science and Engineering",
    status: "New",
    assignedTo: "",
    createdAtUtc: "2026-03-29T11:30:00Z"
  },
  {
    id: "inquiry-2",
    fullName: "Aditya Rao",
    email: "aditya.rao@example.com",
    preferredCampus: "Health Sciences Campus",
    interestedProgram: "B.Sc Allied Health Sciences",
    status: "In Review",
    assignedTo: "Admissions Desk",
    createdAtUtc: "2026-03-28T09:00:00Z"
  }
];

const demoApplications: ApplicationItem[] = [
  {
    id: "application-1",
    applicationNumber: "APP-20260405-1001",
    applicantName: "Riya Menon",
    email: "riya.menon@example.com",
    campusName: "North City Campus",
    programName: "B.Tech Computer Science and Engineering",
    stage: "Application Review",
    status: "Submitted",
    assignedTo: "Admissions Desk",
    createdAtUtc: "2026-04-05T09:30:00Z"
  },
  {
    id: "application-2",
    applicationNumber: "APP-20260405-1002",
    applicantName: "Aditya Rao",
    email: "aditya.rao@example.com",
    campusName: "Health Sciences Campus",
    programName: "B.Sc Allied Health Sciences",
    stage: "Interview Scheduling",
    status: "Qualified",
    assignedTo: "Admissions Desk",
    createdAtUtc: "2026-04-04T10:30:00Z"
  }
];

const demoCounselingSessions: CounselingSessionItem[] = [
  {
    id: "counseling-1",
    applicationId: "application-1",
    applicantName: "Riya Menon",
    programName: "B.Tech Computer Science and Engineering",
    campusName: "North City Campus",
    counselorName: "Admissions Desk",
    scheduledAtUtc: "2026-04-06T10:30:00Z",
    modality: "Campus Visit",
    status: "Scheduled",
    notes: "Prospect asked for scholarship and hostel guidance."
  }
];

const demoDocuments: PendingDocumentItem[] = [
  {
    id: "document-1",
    applicationId: "application-1",
    applicantName: "Riya Menon",
    documentType: "Academic Transcript",
    status: "Requested",
    notes: "Waiting for upload",
    requestedAtUtc: "2026-04-05T11:00:00Z"
  },
  {
    id: "document-2",
    applicationId: "application-2",
    applicantName: "Aditya Rao",
    documentType: "Transfer Certificate",
    status: "Delivered",
    notes: "Initial review completed",
    fileName: "aditya-transfer-certificate.pdf",
    contentType: "application/pdf",
    deliveryChannel: "Portal Download",
    deliveryReference: "DOC-20260405-1001",
    requestedAtUtc: "2026-04-04T11:00:00Z",
    uploadedAtUtc: "2026-04-04T12:00:00Z",
    deliveredAtUtc: "2026-04-05T09:00:00Z"
  }
];

const demoCommunications: CommunicationItem[] = [
  {
    id: "communication-1",
    applicationId: "application-1",
    applicantName: "Riya Menon",
    channel: "Email",
    templateName: "Application Follow-Up",
    subject: "Next steps for your University360 application",
    body: "Please review the counseling schedule and keep your academic transcript ready for verification.",
    status: "Sent",
    createdAtUtc: "2026-04-05T12:00:00Z"
  }
];

const demoReminders: ReminderItem[] = [
  {
    id: "reminder-1",
    applicationId: "application-1",
    applicantName: "Riya Menon",
    reminderType: "Document Follow-Up",
    dueAtUtc: "2026-04-06T09:00:00Z",
    status: "Open",
    notes: "Call the applicant if transcript upload is still pending."
  },
  {
    id: "reminder-2",
    applicationId: "application-2",
    applicantName: "Aditya Rao",
    reminderType: "Offer Review",
    dueAtUtc: "2026-04-06T14:00:00Z",
    status: "Completed",
    notes: "Offer review completed by admissions desk."
  }
];

const demoJourneyTemplates: JourneyTemplateItem[] = [
  { id: "template-1", templateName: "Stale Application Follow-Up", triggerType: "StaleApplication", channel: "Email", subject: "Your University360 application is still active", isActive: true },
  { id: "template-2", templateName: "Document Checklist Reminder", triggerType: "DocumentFollowUp", channel: "SMS", subject: "Pending admissions document", isActive: true }
];

const demoCounselorWorkloads: CounselorWorkloadItem[] = [
  { counselorName: "Ananya Rao", activeApplications: 2, scheduledSessions: 1, followUpsDue: 1, totalLoad: 4, loadStatus: "Busy" },
  { counselorName: "Rahul George", activeApplications: 1, scheduledSessions: 0, followUpsDue: 0, totalLoad: 1, loadStatus: "Balanced" }
];

const demoHelpdeskSummary: HelpdeskSummary = {
  total: 2,
  open: 1,
  inProgress: 1,
  resolved: 0,
  highPriority: 1
};

const demoHelpdeskTickets: HelpdeskTicketItem[] = [
  {
    id: "ticket-1",
    requesterName: "Aarav Sharma",
    requesterRole: "Student",
    department: "IT Department",
    category: "Portal Access",
    title: "Unable to access semester registration portal",
    priority: "High",
    status: "Open",
    assignedTo: "Systems Desk",
    createdAtUtc: "2026-04-05T09:00:00Z"
  },
  {
    id: "ticket-2",
    requesterName: "Prof. Meera Nair",
    requesterRole: "Professor",
    department: "Facility Management",
    category: "Classroom AV",
    title: "Projector issue in B-204",
    priority: "Medium",
    status: "In Progress",
    assignedTo: "AV Support Team",
    createdAtUtc: "2026-04-04T11:00:00Z"
  }
];

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function summarizeApplications(items: ApplicationItem[]) {
  return {
    total: items.length,
    submitted: items.filter((item) => item.status === "Submitted").length,
    underReview: items.filter((item) => item.status === "Under Review").length,
    qualified: items.filter((item) => item.status === "Qualified").length,
    offered: items.filter((item) => item.status === "Offered").length
  };
}

function summarizeAdmissions(
  inquiries: InquiryItem[],
  applications: ApplicationItem[],
  counselingSessions: CounselingSessionItem[] = [],
  documents: PendingDocumentItem[] = [],
  communications: CommunicationItem[] = [],
  reminders: ReminderItem[] = []
): InquirySummary {
  const latest =
    [...inquiries].sort((left, right) => new Date(right.createdAtUtc).getTime() - new Date(left.createdAtUtc).getTime())[0] ?? null;

  return {
    total: inquiries.length,
    newItems: inquiries.filter((item) => item.status === "New").length,
    inReview: inquiries.filter((item) => item.status === "In Review").length,
    latest,
    applications: summarizeApplications(applications),
    counseling: {
      total: counselingSessions.length,
      scheduled: counselingSessions.filter((item) => item.status === "Scheduled").length,
      completed: counselingSessions.filter((item) => item.status === "Completed").length
    },
    documents: {
      total: documents.length,
      pending: documents.filter((item) => item.status === "Requested" || item.status === "Under Review").length,
      verified: documents.filter((item) => item.status === "Verified" || item.status === "Delivered").length
    },
    communications: {
      total: communications.length,
      email: communications.filter((item) => item.channel === "Email").length,
      sms: communications.filter((item) => item.channel === "SMS").length,
      sent: communications.filter((item) => item.status === "Sent").length
    },
    reminders: {
      total: reminders.length,
      open: reminders.filter((item) => item.status === "Open").length,
      completed: reminders.filter((item) => item.status === "Completed").length
    }
  };
}

export default function OperationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [counselingSessions, setCounselingSessions] = useState<CounselingSessionItem[]>([]);
  const [documents, setDocuments] = useState<PendingDocumentItem[]>([]);
  const [communications, setCommunications] = useState<CommunicationItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [journeyTemplates, setJourneyTemplates] = useState<JourneyTemplateItem[]>([]);
  const [counselorWorkloads, setCounselorWorkloads] = useState<CounselorWorkloadItem[]>([]);
  const [helpdeskSummary, setHelpdeskSummary] = useState<HelpdeskSummary>(demoHelpdeskSummary);
  const [helpdeskTickets, setHelpdeskTickets] = useState<HelpdeskTicketItem[]>([]);
  const [inquirySummary, setInquirySummary] = useState<InquirySummary>({ total: 0, newItems: 0, inReview: 0, latest: null });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [updatingInquiryId, setUpdatingInquiryId] = useState<string | null>(null);
  const demoMode = isDemoModeEnabled();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await getAdminSession();

        if (demoMode) {
          if (!cancelled) {
            setNotifications(demoNotifications);
            setAuditLogs(demoAuditLogs);
            setInquiries(demoInquiries);
            setApplications(demoApplications);
            setCounselingSessions(demoCounselingSessions);
            setDocuments(demoDocuments);
            setCommunications(demoCommunications);
            setReminders(demoReminders);
            setJourneyTemplates(demoJourneyTemplates);
            setCounselorWorkloads(demoCounselorWorkloads);
            setHelpdeskSummary(demoHelpdeskSummary);
            setHelpdeskTickets(demoHelpdeskTickets);
            setInquirySummary(summarizeAdmissions(demoInquiries, demoApplications, demoCounselingSessions, demoDocuments, demoCommunications, demoReminders));
            setError(null);
          }
          return;
        }

        const headers = {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        };
        const canCreateAnnouncements = session.permissions.includes("announcements.create");
        const canManageRbac = session.permissions.includes("rbac.manage");
        const canManageFinance = session.permissions.includes("finance.manage");
        const canViewAttendance = session.permissions.includes("attendance.view");
        const canViewResults = session.permissions.includes("results.view");

        const [notificationsPayload, admissionsPayload, applicationsPayload, counselingPayload, documentsPayload, communicationsPayload, remindersPayload, admissionsSummaryPayload, templatesPayload, counselorPayload, helpdeskSummaryPayload, helpdeskTicketsPayload, communicationAuditPayload, studentAuditPayload, academicAuditPayload, examAuditPayload, financeAuditPayload, attendanceAuditPayload, identityAuditPayload] = await Promise.all([
          loadOptionalJson(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}`, headers, true),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/inquiries?pageSize=8`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/applications?pageSize=8`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/counseling-sessions?pageSize=6`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/documents/pending?pageSize=6`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/communications?pageSize=6`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/reminders?pageSize=6`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/summary`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/templates`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/counselor-workloads`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/helpdesk/summary`, headers, true),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/helpdesk/tickets?pageSize=6`, headers, true),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/audit-logs?pageSize=10`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.student()}/api/v1/audit-logs?pageSize=10`, headers, canManageRbac),
          loadOptionalJson(`${apiConfig.academic()}/api/v1/audit-logs?pageSize=10`, headers, canViewResults),
          loadOptionalJson(`${apiConfig.exam()}/api/v1/audit-logs?pageSize=10`, headers, canViewResults),
          loadOptionalJson(`${apiConfig.finance()}/api/v1/audit-logs?pageSize=10`, headers, canManageFinance),
          loadOptionalJson(`${apiConfig.attendance()}/api/v1/audit-logs?pageSize=10`, headers, canViewAttendance),
          loadOptionalJson(`${apiConfig.identity()}/api/v1/audit-logs?pageSize=10`, headers, canManageRbac)
        ]);

        const mergedAuditLogs = [
          ...((communicationAuditPayload?.items ?? []) as AuditLogItem[]),
          ...((studentAuditPayload?.items ?? []) as AuditLogItem[]),
          ...((academicAuditPayload?.items ?? []) as AuditLogItem[]),
          ...((examAuditPayload?.items ?? []) as AuditLogItem[]),
          ...((financeAuditPayload?.items ?? []) as AuditLogItem[]),
          ...((attendanceAuditPayload?.items ?? []) as AuditLogItem[]),
          ...((identityAuditPayload?.items ?? []) as AuditLogItem[])
        ].sort((left, right) => new Date(right.createdAtUtc).getTime() - new Date(left.createdAtUtc).getTime());

        if (!cancelled) {
          setNotifications((notificationsPayload?.items ?? []) as NotificationItem[]);
          const nextInquiries = (admissionsPayload?.items ?? []) as InquiryItem[];
          const nextApplications = (applicationsPayload?.items ?? []) as ApplicationItem[];
          const nextCounselingSessions = (counselingPayload?.items ?? []) as CounselingSessionItem[];
          const nextDocuments = (documentsPayload?.items ?? []) as PendingDocumentItem[];
          const nextCommunications = (communicationsPayload?.items ?? []) as CommunicationItem[];
          const nextReminders = (remindersPayload?.items ?? []) as ReminderItem[];
          const computedSummary = summarizeAdmissions(nextInquiries, nextApplications, nextCounselingSessions, nextDocuments, nextCommunications, nextReminders);
          const remoteSummary = (admissionsSummaryPayload ?? computedSummary) as InquirySummary;
          setInquiries(nextInquiries);
          setApplications(nextApplications);
          setCounselingSessions(nextCounselingSessions);
          setDocuments(nextDocuments);
          setCommunications(nextCommunications);
          setReminders(nextReminders);
          setJourneyTemplates((templatesPayload?.items ?? []) as JourneyTemplateItem[]);
          setCounselorWorkloads((counselorPayload?.items ?? []) as CounselorWorkloadItem[]);
          setHelpdeskSummary((helpdeskSummaryPayload ?? demoHelpdeskSummary) as HelpdeskSummary);
          setHelpdeskTickets((helpdeskTicketsPayload?.items ?? []) as HelpdeskTicketItem[]);
          setInquirySummary({
            ...computedSummary,
            ...remoteSummary,
            latest: remoteSummary.latest ?? computedSummary.latest,
            applications: remoteSummary.applications ?? computedSummary.applications,
            counseling: remoteSummary.counseling ?? computedSummary.counseling,
            documents: remoteSummary.documents ?? computedSummary.documents,
            communications: remoteSummary.communications ?? computedSummary.communications,
            reminders: remoteSummary.reminders ?? computedSummary.reminders
          });
          setAuditLogs(mergedAuditLogs);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          if (loadError instanceof Error && loadError.message.includes("No admin session")) {
            window.location.href = "/auth?role=Operations&redirect=%2Fops";
            return;
          }
          setError(loadError instanceof Error ? loadError.message : "Unexpected operations error.");
        }
      } finally {
        if (!cancelled) {
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

  async function updateInquiryStatus(id: string, status: string) {
    if (demoMode) {
      const nextInquiries = inquiries.map((item) =>
        item.id === id ? { ...item, status, assignedTo: status === "In Review" ? "Admissions Desk" : item.assignedTo } : item
      );
      setInquiries(nextInquiries);
      setInquirySummary(summarizeAdmissions(nextInquiries, applications, counselingSessions, documents, communications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId(id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/inquiries/${id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          assignedTo: status === "In Review" ? session.user.email : undefined
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update the inquiry status.");
      }

      const payload = (await response.json()) as InquiryItem;
      const nextInquiries = inquiries.map((item) => (item.id === id ? payload : item));
      setInquiries(nextInquiries);
      setInquirySummary(summarizeAdmissions(nextInquiries, applications, counselingSessions, documents, communications, reminders));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update the inquiry status.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function convertInquiryToApplication(item: InquiryItem) {
    if (demoMode) {
      const nextApplication: ApplicationItem = {
        id: `application-${Date.now()}`,
        applicationNumber: `APP-20260405-${Math.floor(Math.random() * 9000) + 1000}`,
        applicantName: item.fullName,
        email: item.email,
        campusName: item.preferredCampus,
        programName: item.interestedProgram,
        stage: "Application Review",
        status: "Submitted",
        assignedTo: "Admissions Desk",
        createdAtUtc: new Date().toISOString()
      };
      const nextApplications = [nextApplication, ...applications];
      const nextInquiries = inquiries.map((entry) =>
        entry.id === item.id ? { ...entry, status: "Converted", assignedTo: "Admissions Desk" } : entry
      );
      setApplications(nextApplications);
      setInquiries(nextInquiries);
      setInquirySummary(summarizeAdmissions(nextInquiries, nextApplications, counselingSessions, documents, communications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId(item.id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          inquiryId: item.id,
          applicantName: item.fullName,
          email: item.email,
          campusName: item.preferredCampus,
          programName: item.interestedProgram,
          assignedTo: session.user.email
        })
      });

      if (!response.ok) {
        throw new Error("Unable to create an application from the inquiry.");
      }

      const payload = (await response.json()) as ApplicationItem;
      const nextApplications = [payload, ...applications];
      const nextInquiries = inquiries.map((entry) => (entry.id === item.id ? { ...entry, status: "Converted", assignedTo: session.user.email } : entry));
      setApplications(nextApplications);
      setInquiries(nextInquiries);
      setInquirySummary(summarizeAdmissions(nextInquiries, nextApplications, counselingSessions, documents, communications, reminders));
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : "Unable to create an application from the inquiry.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function updateApplicationStatus(id: string, status: string, stage: string) {
    if (demoMode) {
      const nextApplications = applications.map((item) =>
        item.id === id ? { ...item, status, stage, assignedTo: item.assignedTo || "Admissions Desk" } : item
      );
      setApplications(nextApplications);
      setInquirySummary(summarizeAdmissions(inquiries, nextApplications, counselingSessions, documents, communications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId(id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/applications/${id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          stage,
          assignedTo: session.user.email
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update the application status.");
      }

      const payload = (await response.json()) as ApplicationItem;
      const nextApplications = applications.map((item) => (item.id === id ? payload : item));
      setApplications(nextApplications);
      setInquirySummary(summarizeAdmissions(inquiries, nextApplications, counselingSessions, documents, communications, reminders));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update the application status.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function scheduleCounseling(item: ApplicationItem) {
    if (demoMode) {
      const nextSession: CounselingSessionItem = {
        id: `counseling-${Date.now()}`,
        applicationId: item.id,
        applicantName: item.applicantName,
        programName: item.programName,
        campusName: item.campusName,
        counselorName: item.assignedTo || "Admissions Desk",
        scheduledAtUtc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        modality: "Campus Visit",
        status: "Scheduled",
        notes: "Auto-scheduled from operations hub demo."
      };
      const nextCounselingSessions = [nextSession, ...counselingSessions];
      const nextApplications = applications.map((application) =>
        application.id === item.id ? { ...application, status: application.status === "Submitted" ? "Under Review" : application.status, stage: "Counseling Scheduled" } : application
      );
      setCounselingSessions(nextCounselingSessions);
      setApplications(nextApplications);
      setInquirySummary(summarizeAdmissions(inquiries, nextApplications, nextCounselingSessions, documents, communications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId(item.id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/counseling-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          applicationId: item.id,
          scheduledAtUtc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          counselorName: session.user.email,
          modality: "Campus Visit",
          notes: "Scheduled from operations hub."
        })
      });

      if (!response.ok) {
        throw new Error("Unable to schedule counseling.");
      }

      const payload = (await response.json()) as CounselingSessionItem;
      const nextCounselingSessions = [payload, ...counselingSessions];
      const nextApplications = applications.map((application) =>
        application.id === item.id ? { ...application, status: application.status === "Submitted" ? "Under Review" : application.status, stage: "Counseling Scheduled", assignedTo: session.user.email } : application
      );
      setCounselingSessions(nextCounselingSessions);
      setApplications(nextApplications);
      setInquirySummary(summarizeAdmissions(inquiries, nextApplications, nextCounselingSessions, documents, communications, reminders));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to schedule counseling.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function updateCounselingStatus(id: string, status: string) {
    if (demoMode) {
      const nextCounselingSessions = counselingSessions.map((item) => (item.id === id ? { ...item, status } : item));
      const completed = nextCounselingSessions.find((item) => item.id === id && status === "Completed");
      const nextApplications =
        completed !== undefined
          ? applications.map((item) => (item.id === completed.applicationId ? { ...item, stage: "Document Verification", status: "Under Review" } : item))
          : applications;
      setCounselingSessions(nextCounselingSessions);
      setApplications(nextApplications);
      setInquirySummary(summarizeAdmissions(inquiries, nextApplications, nextCounselingSessions, documents, communications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId(id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/counseling-sessions/${id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error("Unable to update counseling.");
      }

      const payload = (await response.json()) as CounselingSessionItem;
      const nextCounselingSessions = counselingSessions.map((item) => (item.id === id ? payload : item));
      const nextApplications =
        status === "Completed"
          ? applications.map((item) => (item.id === payload.applicationId ? { ...item, stage: "Document Verification", status: "Under Review" } : item))
          : applications;
      setCounselingSessions(nextCounselingSessions);
      setApplications(nextApplications);
      setInquirySummary(summarizeAdmissions(inquiries, nextApplications, nextCounselingSessions, documents, communications, reminders));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update counseling.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function requestDocument(item: ApplicationItem) {
    if (demoMode) {
      const nextDocument: PendingDocumentItem = {
        id: `document-${Date.now()}`,
        applicationId: item.id,
        applicantName: item.applicantName,
        documentType: "Academic Transcript",
        status: "Requested",
        notes: "Requested from admissions desk",
        requestedAtUtc: new Date().toISOString()
      };
      const nextDocuments = [nextDocument, ...documents];
      const nextApplications = applications.map((application) => (application.id === item.id ? { ...application, stage: "Document Verification" } : application));
      setDocuments(nextDocuments);
      setApplications(nextApplications);
      setInquirySummary(summarizeAdmissions(inquiries, nextApplications, counselingSessions, nextDocuments, communications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId(item.id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/applications/${item.id}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          documentType: "Academic Transcript",
          notes: "Requested from operations hub."
        })
      });

      if (!response.ok) {
        throw new Error("Unable to request a document.");
      }

      const payload = (await response.json()) as PendingDocumentItem;
      const nextDocuments = [payload, ...documents];
      const nextApplications = applications.map((application) => (application.id === item.id ? { ...application, stage: "Document Verification" } : application));
      setDocuments(nextDocuments);
      setApplications(nextApplications);
      setInquirySummary(summarizeAdmissions(inquiries, nextApplications, counselingSessions, nextDocuments, communications, reminders));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to request a document.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function updateDocumentStatus(id: string, status: string) {
    if (demoMode) {
      const nextDocuments = documents.map((item) => (item.id === id ? { ...item, status } : item));
      setDocuments(nextDocuments);
      setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, nextDocuments, communications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId(id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/documents/${id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error("Unable to update document verification.");
      }

      const payload = (await response.json()) as PendingDocumentItem;
      const nextDocuments = documents.map((item) => (item.id === id ? payload : item));
      const relatedDocuments = nextDocuments.filter((item) => item.applicationId === payload.applicationId);
      const allVerified = relatedDocuments.length > 0 && relatedDocuments.every((item) => item.status === "Verified");
      const nextApplications =
        allVerified
          ? applications.map((item) => (item.id === payload.applicationId ? { ...item, status: "Qualified", stage: "Ready For Offer Review" } : item))
          : applications;
      setDocuments(nextDocuments);
      setApplications(nextApplications);
      setInquirySummary(summarizeAdmissions(inquiries, nextApplications, counselingSessions, nextDocuments, communications, reminders));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update document verification.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function uploadDocumentPacket(item: PendingDocumentItem) {
    if (demoMode) {
      const nextDocuments = documents.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              status: entry.status === "Requested" ? "Under Review" : entry.status,
              fileName: entry.fileName ?? `${entry.applicantName.toLowerCase().replace(/\s+/g, "-")}-${entry.documentType.toLowerCase().replace(/\s+/g, "-")}.pdf`,
              contentType: "application/pdf",
              uploadedAtUtc: new Date().toISOString(),
              notes: "Upload packet prepared from the operations hub."
            }
          : entry
      );
      setDocuments(nextDocuments);
      setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, nextDocuments, communications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId(item.id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/documents/${item.id}/upload-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          fileName: `${item.applicantName.toLowerCase().replace(/\s+/g, "-")}-${item.documentType.toLowerCase().replace(/\s+/g, "-")}.pdf`,
          contentType: "application/pdf"
        })
      });

      if (!response.ok) {
        throw new Error("Unable to prepare document upload.");
      }

      const payload = await response.json();
      const nextDocument = (payload?.document ?? item) as PendingDocumentItem;
      const nextDocuments = documents.map((entry) => (entry.id === item.id ? nextDocument : entry));
      setDocuments(nextDocuments);
      setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, nextDocuments, communications, reminders));
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to prepare document upload.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function deliverDocument(item: PendingDocumentItem) {
    if (demoMode) {
      const nextDocuments = documents.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              status: "Delivered",
              deliveryChannel: "Portal Download",
              deliveryReference: entry.deliveryReference ?? `DOC-${new Date().getFullYear()}-1001`,
              deliveredAtUtc: new Date().toISOString(),
              notes: "Delivered to the applicant from the operations hub."
            }
          : entry
      );
      setDocuments(nextDocuments);
      setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, nextDocuments, communications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId(item.id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/documents/${item.id}/deliver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          deliveryChannel: "Portal Download",
          notes: "Delivered to the applicant from the operations hub."
        })
      });

      if (!response.ok) {
        throw new Error("Unable to deliver document.");
      }

      const payload = (await response.json()) as PendingDocumentItem;
      const nextDocuments = documents.map((entry) => (entry.id === item.id ? payload : entry));
      setDocuments(nextDocuments);
      setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, nextDocuments, communications, reminders));
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to deliver document.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function downloadDocument(item: PendingDocumentItem) {
    if (!item.fileName && demoMode) {
      return;
    }

    if (demoMode) {
      setError(null);
      return;
    }

    try {
      setUpdatingInquiryId(item.id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/documents/${item.id}/download-url`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to generate document download.");
      }

      const payload = await response.json();
      if (payload?.url) {
        window.open(payload.url, "_blank", "noopener,noreferrer");
      }
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to generate document download.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function sendApplicantCommunication(item: ApplicationItem) {
    if (demoMode) {
      const nextCommunication: CommunicationItem = {
        id: `communication-${Date.now()}`,
        applicationId: item.id,
        applicantName: item.applicantName,
        channel: "Email",
        templateName: "Manual Follow-Up",
        subject: `Update for ${item.programName}`,
        body: "Your application is progressing. Please review the latest admissions checklist and keep documents ready.",
        status: "Sent",
        createdAtUtc: new Date().toISOString()
      };
      const nextCommunications = [nextCommunication, ...communications];
      setCommunications(nextCommunications);
      setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, documents, nextCommunications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId(item.id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/communications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          applicationId: item.id,
          channel: "Email",
          templateName: "Manual Follow-Up",
          subject: `Update for ${item.programName}`,
          body: "Your application is progressing. Please review the latest admissions checklist and keep documents ready."
        })
      });

      if (!response.ok) {
        throw new Error("Unable to send applicant communication.");
      }

      const payload = (await response.json()) as CommunicationItem;
      const nextCommunications = [payload, ...communications];
      setCommunications(nextCommunications);
      setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, documents, nextCommunications, reminders));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to send applicant communication.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function updateReminderStatus(id: string, status: string) {
    if (demoMode) {
      const nextReminders = reminders.map((item) => (item.id === id ? { ...item, status } : item));
      setReminders(nextReminders);
      setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, documents, communications, nextReminders));
      return;
    }

    try {
      setUpdatingInquiryId(id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/reminders/${id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error("Unable to update reminder status.");
      }

      const payload = (await response.json()) as ReminderItem;
      const nextReminders = reminders.map((item) => (item.id === id ? payload : item));
      setReminders(nextReminders);
      setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, documents, communications, nextReminders));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update reminder status.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function runOutreachAutomation() {
    if (demoMode) {
      const nextCommunications = [
        {
          id: `communication-${Date.now()}`,
          applicationId: applications[0]?.id ?? "application-1",
          applicantName: applications[0]?.applicantName ?? "Riya Menon",
          channel: "Email",
          templateName: "Stale Application Follow-Up",
          subject: "Your University360 application is still active",
          body: "Automation created an outreach reminder from the operations hub.",
          status: "Sent",
          createdAtUtc: new Date().toISOString()
        },
        ...communications
      ];
      setCommunications(nextCommunications);
      setCounselorWorkloads(demoCounselorWorkloads);
      setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, documents, nextCommunications, reminders));
      return;
    }

    try {
      setUpdatingInquiryId("outreach-run");
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/admissions/outreach/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        }
      });

      if (!response.ok) {
        throw new Error("Unable to run admissions outreach automation.");
      }

      const [communicationsPayload, counselorPayload] = await Promise.all([
        fetch(`${apiConfig.communication()}/api/v1/admissions/communications?pageSize=6`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "X-Tenant-Id": session.user.tenantId
          }
        }),
        fetch(`${apiConfig.communication()}/api/v1/admissions/counselor-workloads`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "X-Tenant-Id": session.user.tenantId
          }
        })
      ]);

      if (communicationsPayload.ok) {
        const payload = await communicationsPayload.json();
        const nextCommunications = (payload?.items ?? []) as CommunicationItem[];
        setCommunications(nextCommunications);
        setInquirySummary(summarizeAdmissions(inquiries, applications, counselingSessions, documents, nextCommunications, reminders));
      }

      if (counselorPayload.ok) {
        const payload = await counselorPayload.json();
        setCounselorWorkloads((payload?.items ?? []) as CounselorWorkloadItem[]);
      }

      setError(null);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run admissions outreach automation.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  async function updateHelpdeskStatus(item: HelpdeskTicketItem, status: string) {
    if (demoMode) {
      const nextTickets = helpdeskTickets.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              status,
              assignedTo: entry.assignedTo || "Operations Desk",
              resolutionNote: status === "Resolved" ? "Closed from the operations hub." : entry.resolutionNote
            }
          : entry
      );
      setHelpdeskTickets(nextTickets);
      setHelpdeskSummary({
        total: nextTickets.length,
        open: nextTickets.filter((entry) => entry.status === "Open").length,
        inProgress: nextTickets.filter((entry) => entry.status === "In Progress").length,
        resolved: nextTickets.filter((entry) => entry.status === "Resolved" || entry.status === "Closed").length,
        highPriority: nextTickets.filter((entry) => entry.priority === "High").length
      });
      return;
    }

    try {
      setUpdatingInquiryId(item.id);
      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.communication()}/api/v1/helpdesk/tickets/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          assignedTo: item.assignedTo || session.user.email,
          resolutionNote: status === "Resolved" ? "Closed from the operations hub." : item.resolutionNote
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update helpdesk ticket.");
      }

      const payload = (await response.json()) as HelpdeskTicketItem;
      const nextTickets = helpdeskTickets.map((entry) => (entry.id === item.id ? payload : entry));
      setHelpdeskTickets(nextTickets);
      setHelpdeskSummary({
        total: nextTickets.length,
        open: nextTickets.filter((entry) => entry.status === "Open").length,
        inProgress: nextTickets.filter((entry) => entry.status === "In Progress").length,
        resolved: nextTickets.filter((entry) => entry.status === "Resolved" || entry.status === "Closed").length,
        highPriority: nextTickets.filter((entry) => entry.priority === "High").length
      });
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update helpdesk ticket.");
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  return (
    <main className="panel-grid min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-white/10 bg-[rgba(8,20,36,0.82)] px-6 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Operations Hub</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Public demand, notifications, and audit visibility in one place.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                This workspace now closes the loop between the refreshed public website and internal teams by exposing the admissions pipeline alongside operational activity.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                Public Homepage
              </Link>
              <Link href="/portal" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                Role Portal
              </Link>
              <Link href="/rbac" className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15">
                RBAC Console
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
              >
                {signingOut ? "Signing Out..." : "Sign Out"}
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="mt-6 rounded-[1.5rem] border border-rose-400/25 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">{error}</div> : null}

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <article className="rounded-[1.7rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Admissions inquiries</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : inquirySummary.total}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Total public inquiries now visible to operations.</p>
          </article>
          <article className="rounded-[1.7rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">New inquiries</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : inquirySummary.newItems}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Leads still waiting for first-touch follow-up.</p>
          </article>
          <article className="rounded-[1.7rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Notifications</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : notifications.length}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Role-available notifications, not just publisher-only feeds.</p>
          </article>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-4">
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Applications</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.applications?.total ?? 0}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Submitted</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.applications?.submitted ?? 0}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Qualified</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.applications?.qualified ?? 0}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Offered</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.applications?.offered ?? 0}</p>
          </article>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-4">
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Counseling</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.counseling?.total ?? 0}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Scheduled</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.counseling?.scheduled ?? 0}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending docs</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.documents?.pending ?? 0}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Verified docs</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.documents?.verified ?? 0}</p>
          </article>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-4">
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Communications</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.communications?.total ?? 0}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Emails</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.communications?.email ?? 0}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Reminders</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.reminders?.total ?? 0}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Open reminders</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : inquirySummary.reminders?.open ?? 0}</p>
          </article>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-4">
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Helpdesk tickets</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : helpdeskSummary.total}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Open</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : helpdeskSummary.open}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">In progress</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : helpdeskSummary.inProgress}</p>
          </article>
          <article className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">High priority</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : helpdeskSummary.highPriority}</p>
          </article>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Admissions Pipeline</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Public demand now lands in ops</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {loading ? "Loading" : `${inquirySummary.inReview} in review`}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {inquiries.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.fullName}</p>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.interestedProgram}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.preferredCampus || "Campus preference not shared"}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">
                    {item.email} | {item.assignedTo || "Unassigned"} | {formatTimestamp(item.createdAtUtc)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateInquiryStatus(item.id, "In Review")}
                      disabled={updatingInquiryId === item.id || item.status === "In Review"}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                    >
                      {updatingInquiryId === item.id ? "Updating..." : "Mark In Review"}
                    </button>
                    <button
                      type="button"
                      onClick={() => convertInquiryToApplication(item)}
                      disabled={updatingInquiryId === item.id || item.status === "Converted"}
                      className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-fuchsia-100 disabled:opacity-50"
                    >
                      {updatingInquiryId === item.id ? "Working..." : "Create Application"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateInquiryStatus(item.id, "Contacted")}
                      disabled={updatingInquiryId === item.id || item.status === "Contacted"}
                      className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                    >
                      {updatingInquiryId === item.id ? "Updating..." : "Mark Contacted"}
                    </button>
                  </div>
                </article>
              ))}

              {!loading && inquiries.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No admissions inquiries are available for the current tenant yet.</div> : null}
            </div>
          </section>

          <div className="grid gap-5">
            <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300">Applications</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">From inquiry to application stage</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {loading ? "Loading" : `${applications.length} items`}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {applications.map((item) => (
                  <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.applicantName}</p>
                      <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-fuchsia-100">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.programName}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.campusName} | {item.stage}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">
                      {item.applicationNumber} | {item.assignedTo || "Unassigned"} | {formatTimestamp(item.createdAtUtc)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => sendApplicantCommunication(item)}
                        disabled={updatingInquiryId === item.id}
                        className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-sky-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Working..." : "Send Follow-Up"}
                      </button>
                      <button
                        type="button"
                        onClick={() => scheduleCounseling(item)}
                        disabled={updatingInquiryId === item.id}
                        className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-amber-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Working..." : "Schedule Counseling"}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDocument(item)}
                        disabled={updatingInquiryId === item.id}
                        className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Working..." : "Request Document"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateApplicationStatus(item.id, "Under Review", "Document Verification")}
                        disabled={updatingInquiryId === item.id || item.status === "Under Review"}
                        className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Mark Under Review"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateApplicationStatus(item.id, "Qualified", "Interview Scheduling")}
                        disabled={updatingInquiryId === item.id || item.status === "Qualified"}
                        className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-amber-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Mark Qualified"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateApplicationStatus(item.id, "Offered", "Offer Released")}
                        disabled={updatingInquiryId === item.id || item.status === "Offered"}
                        className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Mark Offered"}
                      </button>
                    </div>
                  </article>
                ))}

                {!loading && applications.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No admissions applications have been created yet.</div> : null}
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Counseling</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Guidance and visit scheduling</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {loading ? "Loading" : `${counselingSessions.length} items`}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {counselingSessions.map((item) => (
                  <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.applicantName}</p>
                      <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-amber-100">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.programName}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.campusName} | {item.modality}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">
                      {item.counselorName || "Admissions Desk"} | {formatTimestamp(item.scheduledAtUtc)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateCounselingStatus(item.id, "Completed")}
                        disabled={updatingInquiryId === item.id || item.status === "Completed"}
                        className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Mark Completed"}
                      </button>
                    </div>
                  </article>
                ))}

                {!loading && counselingSessions.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No counseling sessions are scheduled yet.</div> : null}
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-200">Journey Automation</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Template-driven outreach and counselor balancing</h2>
                </div>
                <button
                  type="button"
                  onClick={runOutreachAutomation}
                  disabled={updatingInquiryId === "outreach-run"}
                  className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-fuchsia-100 disabled:opacity-50"
                >
                  {updatingInquiryId === "outreach-run" ? "Running..." : "Run Outreach"}
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  {journeyTemplates.map((item) => (
                    <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{item.templateName}</p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.channel}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{item.triggerType}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{item.subject}</p>
                    </article>
                  ))}
                </div>
                <div className="space-y-4">
                  {counselorWorkloads.map((item) => (
                    <article key={item.counselorName} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{item.counselorName}</p>
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100">{item.loadStatus}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">Applications {item.activeApplications} | Sessions {item.scheduledSessions} | Follow-ups {item.followUpsDue}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-fuchsia-200">Total load {item.totalLoad}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Documents</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Applicant checklist verification</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {loading ? "Loading" : `${documents.length} items`}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {documents.map((item) => (
                  <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.applicantName}</p>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.documentType}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.notes || "No notes added."}</p>
                    {item.fileName ? <p className="mt-2 text-sm leading-6 text-slate-400">File: {item.fileName}</p> : null}
                    {item.deliveryReference ? <p className="mt-2 text-sm leading-6 text-emerald-200">Delivery: {item.deliveryReference} | {item.deliveryChannel}</p> : null}
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{formatTimestamp(item.requestedAtUtc)}</p>
                    {item.uploadedAtUtc ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-200">Uploaded {formatTimestamp(item.uploadedAtUtc)}</p> : null}
                    {item.deliveredAtUtc ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-emerald-200">Delivered {formatTimestamp(item.deliveredAtUtc)}</p> : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => uploadDocumentPacket(item)}
                        disabled={updatingInquiryId === item.id || Boolean(item.fileName)}
                        className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-sky-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Prepare Upload"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDocumentStatus(item.id, "Verified")}
                        disabled={updatingInquiryId === item.id || item.status === "Verified" || item.status === "Delivered"}
                        className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Mark Verified"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDocumentStatus(item.id, "Under Review")}
                        disabled={updatingInquiryId === item.id || item.status === "Under Review"}
                        className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-amber-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Needs Review"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deliverDocument(item)}
                        disabled={updatingInquiryId === item.id || item.status === "Delivered" || !item.fileName}
                        className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-fuchsia-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Deliver"}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadDocument(item)}
                        disabled={updatingInquiryId === item.id || !item.fileName}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-200 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Download"}
                      </button>
                    </div>
                  </article>
                ))}

                {!loading && documents.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No applicant documents are pending yet.</div> : null}
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Communications</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Applicant follow-ups sent by ops</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {loading ? "Loading" : `${communications.length} items`}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {communications.map((item) => (
                  <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.applicantName}</p>
                      <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-sky-100">
                        {item.channel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.subject}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.templateName} | {item.status}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{formatTimestamp(item.createdAtUtc)}</p>
                  </article>
                ))}

                {!loading && communications.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No applicant communications have been sent yet.</div> : null}
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-rose-200">Reminders</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Follow-up queue that still needs action</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {loading ? "Loading" : `${reminders.length} items`}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {reminders.map((item) => (
                  <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.applicantName}</p>
                      <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-rose-100">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.reminderType}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.notes || "No notes added."}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{formatTimestamp(item.dueAtUtc)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateReminderStatus(item.id, "Completed")}
                        disabled={updatingInquiryId === item.id || item.status === "Completed"}
                        className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Complete"}
                      </button>
                    </div>
                  </article>
                ))}

                {!loading && reminders.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No follow-up reminders are open yet.</div> : null}
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Helpdesk</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Department support queue</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {loading ? "Loading" : `${helpdeskTickets.length} items`}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {helpdeskTickets.map((item) => (
                  <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-amber-100">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.requesterName} | {item.requesterRole}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.department} | {item.category} | {item.priority}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Assigned to: {item.assignedTo || "Unassigned"}</p>
                    {item.resolutionNote ? <p className="mt-2 text-sm leading-6 text-emerald-200">{item.resolutionNote}</p> : null}
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{formatTimestamp(item.createdAtUtc)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateHelpdeskStatus(item, "In Progress")}
                        disabled={updatingInquiryId === item.id || item.status === "In Progress" || item.status === "Resolved"}
                        className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Mark In Progress"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateHelpdeskStatus(item, "Resolved")}
                        disabled={updatingInquiryId === item.id || item.status === "Resolved"}
                        className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                      >
                        {updatingInquiryId === item.id ? "Updating..." : "Resolve"}
                      </button>
                    </div>
                  </article>
                ))}

                {!loading && helpdeskTickets.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No helpdesk tickets are active right now.</div> : null}
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Notifications</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">What needs attention now</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {loading ? "Loading" : `${notifications.length} items`}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {notifications.map((item) => (
                  <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.audience}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{item.message}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">
                      {item.source} | {formatTimestamp(item.createdAtUtc)}
                    </p>
                  </article>
                ))}

                {!loading && notifications.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No notifications are available for the current role yet.</div> : null}
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Audit Trail</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Recent operational changes</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {loading ? "Loading" : `${auditLogs.length} records`}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {auditLogs.map((entry) => (
                  <article key={entry.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{entry.action}</p>
                      <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{formatTimestamp(entry.createdAtUtc)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{entry.details}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">
                      Actor: {entry.actor} | Entity: {entry.entityId}
                    </p>
                  </article>
                ))}

                {!loading && auditLogs.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No audit records are available yet for the current tenant.</div> : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

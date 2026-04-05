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
};

async function loadOptionalJson(url: string, headers: HeadersInit, enabled: boolean) {
  if (!enabled) {
    return null;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    return null;
  }

  return response.json();
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

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function OperationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [inquirySummary, setInquirySummary] = useState<InquirySummary>({ total: 0, newItems: 0, inReview: 0, latest: null });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const demoMode = isDemoModeEnabled();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (demoMode) {
          if (!cancelled) {
            setNotifications(demoNotifications);
            setAuditLogs(demoAuditLogs);
            setInquiries(demoInquiries);
            setInquirySummary({ total: 2, newItems: 1, inReview: 1, latest: demoInquiries[0] });
            setError(null);
          }
          return;
        }

        const session = await getAdminSession();
        const headers = {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        };
        const canCreateAnnouncements = session.permissions.includes("announcements.create");
        const canManageRbac = session.permissions.includes("rbac.manage");
        const canManageFinance = session.permissions.includes("finance.manage");
        const canViewAttendance = session.permissions.includes("attendance.view");
        const canViewResults = session.permissions.includes("results.view");

        const [notificationsPayload, admissionsPayload, admissionsSummaryPayload, communicationAuditPayload, studentAuditPayload, academicAuditPayload, examAuditPayload, financeAuditPayload, attendanceAuditPayload, identityAuditPayload] = await Promise.all([
          loadOptionalJson(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}`, headers, true),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/inquiries?pageSize=8`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/admissions/summary`, headers, canCreateAnnouncements),
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
          setInquiries((admissionsPayload?.items ?? []) as InquiryItem[]);
          setInquirySummary((admissionsSummaryPayload ?? { total: 0, newItems: 0, inReview: 0, latest: null }) as InquirySummary);
          setAuditLogs(mergedAuditLogs);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
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
                </article>
              ))}

              {!loading && inquiries.length === 0 ? <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No admissions inquiries are available for the current tenant yet.</div> : null}
            </div>
          </section>

          <div className="grid gap-5">
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

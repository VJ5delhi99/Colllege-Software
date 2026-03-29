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
    title: "Placement drive coordination",
    message: "Corporate relations has opened coordination windows for next month's placement drive.",
    audience: "Admin",
    source: "operations",
    createdAtUtc: "2026-03-28T11:30:00Z"
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
    action: "student.enrollment.created",
    entityId: "enrollment-402",
    actor: "Admin",
    details: "Student enrolled in CSE401 for 2026-SPRING",
    createdAtUtc: "2026-03-28T14:10:00Z"
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

        const [notificationsPayload, communicationAuditPayload, studentAuditPayload, financeAuditPayload, attendanceAuditPayload, identityAuditPayload] = await Promise.all([
          loadOptionalJson(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/audit-logs?pageSize=10`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.student()}/api/v1/audit-logs?pageSize=10`, headers, canManageRbac),
          loadOptionalJson(`${apiConfig.finance()}/api/v1/audit-logs?pageSize=10`, headers, canManageFinance),
          loadOptionalJson(`${apiConfig.attendance()}/api/v1/audit-logs?pageSize=10`, headers, canViewAttendance),
          loadOptionalJson(`${apiConfig.identity()}/api/v1/audit-logs?pageSize=10`, headers, canManageRbac)
        ]);

        const mergedAuditLogs = [
          ...((communicationAuditPayload?.items ?? []) as AuditLogItem[]),
          ...((studentAuditPayload?.items ?? []) as AuditLogItem[]),
          ...((financeAuditPayload?.items ?? []) as AuditLogItem[]),
          ...((attendanceAuditPayload?.items ?? []) as AuditLogItem[]),
          ...((identityAuditPayload?.items ?? []) as AuditLogItem[])
        ].sort((left, right) => new Date(right.createdAtUtc).getTime() - new Date(left.createdAtUtc).getTime());

        if (!cancelled) {
          setNotifications((notificationsPayload?.items ?? []) as NotificationItem[]);
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
    return () => {
      cancelled = true;
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
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Notifications, audit visibility, and authenticated next actions.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Use this page as the role-aware entry point after sign-in. It brings together key communications and recent operational changes instead of sending users directly into disconnected modules.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                Public Homepage
              </Link>
              <Link href="/rbac" className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15">
                RBAC Console
              </Link>
              <Link href="/portal" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                Role Portal
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

        {error ? (
          <div className="mt-6 rounded-[1.5rem] border border-rose-400/25 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
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
                    {item.source} · {formatTimestamp(item.createdAtUtc)}
                  </p>
                </article>
              ))}

              {!loading && notifications.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">
                  No notifications are available for the current role yet.
                </div>
              ) : null}
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
                    Actor: {entry.actor} · Entity: {entry.entityId}
                  </p>
                </article>
              ))}

              {!loading && auditLogs.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">
                  No audit records are available yet for the current tenant.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

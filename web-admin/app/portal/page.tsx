"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiConfig } from "../api-config";
import { getAdminSession, logoutAdmin, type AuthSession } from "../auth-client";
import { isDemoModeEnabled } from "../demo-mode";

type RolePortalState = {
  headline: string;
  summary: string;
  primaryAction: { label: string; href: string };
  secondaryAction: { label: string; href: string };
  cards: Array<{ title: string; value: string; note: string }>;
};

const demoStudentState: RolePortalState = {
  headline: "Student workspace with the next academic step in front.",
  summary: "Track attendance, results, upcoming classes, and fee posture from a single student-friendly surface.",
  primaryAction: { label: "Review results", href: "/portal" },
  secondaryAction: { label: "Open public homepage", href: "/" },
  cards: [
    { title: "Attendance", value: "83%", note: "Physics recovery needed this week." },
    { title: "Fee status", value: "INR 57,000", note: "Captured paid transactions for this tenant snapshot." },
    { title: "Next class", value: "CSE401", note: "Starts tomorrow at 9:30 AM." },
    { title: "Notifications", value: "2", note: "Unread academic notices." }
  ]
};

const demoTeacherState: RolePortalState = {
  headline: "Teacher workflow that keeps classes, attendance, and student outcomes connected.",
  summary: "Manage attendance capture, class cadence, and communication without hopping between disconnected tools.",
  primaryAction: { label: "Open operations hub", href: "/ops" },
  secondaryAction: { label: "Review roles", href: "/rbac" },
  cards: [
    { title: "Active sessions", value: "3", note: "Classes still open for attendance capture." },
    { title: "Student alerts", value: "5", note: "Low attendance and grading follow-ups." },
    { title: "Announcements", value: "4", note: "Recent department-wide communications." },
    { title: "Course load", value: "6", note: "Assigned teaching sections this term." }
  ]
};

const demoAdminState: RolePortalState = {
  headline: "Admin oversight across campuses, people, and institutional risk.",
  summary: "Use the admin portal to move from public discovery into authenticated action with analytics, audit visibility, and role controls.",
  primaryAction: { label: "Open operations hub", href: "/ops" },
  secondaryAction: { label: "Review RBAC", href: "/rbac" },
  cards: [
    { title: "Enrollment", value: "2,480", note: "Across active colleges and campuses." },
    { title: "Fee collection", value: "INR 57,000", note: "Paid transaction total in current snapshot." },
    { title: "Audit events", value: "14", note: "Recent traced operational changes." },
    { title: "Announcements", value: "6", note: "Published notices this cycle." }
  ]
};

function formatCurrency(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

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

function buildPortalState(
  session: AuthSession,
  metrics: {
    attendancePercentage?: number;
    feeCollection?: number;
    notificationCount?: number;
    announcementCount?: number;
    auditCount?: number;
    userTotal?: number;
    nextCourse?: string;
  }
): RolePortalState {
  const role = session.user.role;

  if (role === "Student") {
    return {
      headline: "Student workspace with the next academic step in front.",
      summary: "See attendance health, fee posture, upcoming classes, and notifications in a calm surface built for daily student decisions.",
      primaryAction: { label: "Back to homepage", href: "/" },
      secondaryAction: { label: "Open auth", href: "/auth" },
      cards: [
        { title: "Attendance", value: `${metrics.attendancePercentage ?? 0}%`, note: "Current attendance summary." },
        { title: "Fee status", value: formatCurrency(metrics.feeCollection ?? 0), note: "Recorded paid transactions under this profile." },
        { title: "Next class", value: metrics.nextCourse ?? "No class scheduled", note: "Closest academic event from the current feed." },
        { title: "Notifications", value: `${metrics.notificationCount ?? 0}`, note: "Unread student-facing alerts." }
      ]
    };
  }

  if (role === "Professor" || role === "Teacher") {
    return {
      headline: "Teacher workflow that keeps classes, attendance, and student outcomes connected.",
      summary: "Stay on top of active sessions, communication, and operational issues without losing context between teaching and administration.",
      primaryAction: { label: "Open operations hub", href: "/ops" },
      secondaryAction: { label: "Back to homepage", href: "/" },
      cards: [
        { title: "Attendance", value: `${metrics.attendancePercentage ?? 0}%`, note: "Current attendance rate across captured records." },
        { title: "Announcements", value: `${metrics.announcementCount ?? 0}`, note: "Recent communication volume." },
        { title: "Notifications", value: `${metrics.notificationCount ?? 0}`, note: "Teacher-facing updates ready for review." },
        { title: "Next class", value: metrics.nextCourse ?? "No class scheduled", note: "Upcoming academic pulse." }
      ]
    };
  }

  return {
    headline: "Admin oversight across campuses, people, and institutional risk.",
    summary: "Move directly into operational control with live signals for enrollment, finance, announcements, and recent audited changes.",
    primaryAction: { label: "Open operations hub", href: "/ops" },
    secondaryAction: { label: "Review RBAC", href: "/rbac" },
    cards: [
      { title: "Enrollment", value: `${metrics.userTotal ?? 0}`, note: "Visible users in the current tenant scope." },
      { title: "Fee collection", value: formatCurrency(metrics.feeCollection ?? 0), note: "Paid transaction total." },
      { title: "Audit events", value: `${metrics.auditCount ?? 0}`, note: "Recent traced changes across services." },
      { title: "Announcements", value: `${metrics.announcementCount ?? 0}`, note: "Published communication volume." }
    ]
  };
}

export default function PortalPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [portalState, setPortalState] = useState<RolePortalState | null>(null);
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
            setPortalState(demoAdminState);
            setError(null);
          }
          return;
        }

        const activeSession = await getAdminSession();
        const headers = {
          Authorization: `Bearer ${activeSession.accessToken}`,
          "X-Tenant-Id": activeSession.user.tenantId
        };
        const canManageRbac = activeSession.permissions.includes("rbac.manage");
        const canViewAttendance = activeSession.permissions.includes("attendance.view");
        const canViewResults = activeSession.permissions.includes("results.view");
        const canManageFinance = activeSession.permissions.includes("finance.manage");
        const canCreateAnnouncements = activeSession.permissions.includes("announcements.create");

        const [
          usersPayload,
          attendancePayload,
          financePayload,
          communicationPayload,
          academicPayload,
          notificationsPayload,
          communicationAuditPayload,
          studentAuditPayload,
          financeAuditPayload,
          attendanceAuditPayload,
          identityAuditPayload
        ] = await Promise.all([
          loadOptionalJson(`${apiConfig.identity()}/api/v1/users`, headers, canManageRbac),
          loadOptionalJson(`${apiConfig.attendance()}/api/v1/analytics/summary`, headers, canViewAttendance),
          loadOptionalJson(`${apiConfig.finance()}/api/v1/payments/summary`, headers, canManageFinance),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/dashboard/summary`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.academic()}/api/v1/dashboard/summary`, headers, canViewResults),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(activeSession.user.role)}`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.communication()}/api/v1/audit-logs?pageSize=5`, headers, canCreateAnnouncements),
          loadOptionalJson(`${apiConfig.student()}/api/v1/audit-logs?pageSize=5`, headers, canManageRbac),
          loadOptionalJson(`${apiConfig.finance()}/api/v1/audit-logs?pageSize=5`, headers, canManageFinance),
          loadOptionalJson(`${apiConfig.attendance()}/api/v1/audit-logs?pageSize=5`, headers, canViewAttendance),
          loadOptionalJson(`${apiConfig.identity()}/api/v1/audit-logs?pageSize=5`, headers, canManageRbac)
        ]);

        const auditCount =
          (communicationAuditPayload?.items?.length ?? 0) +
          (studentAuditPayload?.items?.length ?? 0) +
          (financeAuditPayload?.items?.length ?? 0) +
          (attendanceAuditPayload?.items?.length ?? 0) +
          (identityAuditPayload?.items?.length ?? 0);

        if (!cancelled) {
          setSession(activeSession);
          setPortalState(
            buildPortalState(activeSession, {
              attendancePercentage: attendancePayload?.percentage,
              feeCollection: financePayload?.totalCollected,
              notificationCount: notificationsPayload?.items?.length ?? 0,
              announcementCount: communicationPayload?.total,
              auditCount,
              userTotal: Array.isArray(usersPayload) ? usersPayload.length : 0,
              nextCourse: academicPayload?.nextCourse?.title
            })
          );
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unexpected portal error.");
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

  const heroState =
    portalState ??
    (session?.user.role === "Student"
      ? demoStudentState
      : session?.user.role === "Professor" || session?.user.role === "Teacher"
        ? demoTeacherState
        : demoAdminState);

  const currentRole = session?.user.role ?? (demoMode ? "Principal" : "Authenticated user");
  const roleLabel = currentRole === "Professor" ? "Teacher" : currentRole;

  return (
    <main className="panel-grid min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(7,18,34,0.95),rgba(14,40,73,0.86)_58%,rgba(5,13,25,0.96))] px-6 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Role-aware portal</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{heroState.headline}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{heroState.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200">
                  {loading ? "Syncing" : roleLabel}
                </span>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
                  {demoMode ? "Demo Mode" : session?.user.tenantId ?? "Secure tenant context"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={heroState.primaryAction.href} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                {heroState.primaryAction.label}
              </Link>
              <Link href={heroState.secondaryAction.href} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                {heroState.secondaryAction.label}
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

        {error ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm leading-6 text-amber-50">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {heroState.cards.map((card) => (
            <article key={card.title} className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] px-5 py-5 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{card.title}</p>
              <p className="mt-5 text-3xl font-semibold text-white">{loading ? "..." : card.value}</p>
              <p className="mt-3 text-sm leading-6 text-cyan-100/90">{card.note}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Student path</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Keep learners focused on what is due next.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Attendance, results, classes, and fee posture should be visible immediately instead of buried under admin-first navigation.
            </p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Teacher path</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Reduce repetitive staff motion between modules.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Teaching staff need fast access to attendance, communication, and class context without carrying operational overhead from admin-only surfaces.
            </p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300">Admin path</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Trace decisions with audit and operations context.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Administrative users should be able to pivot from role control to communications, finance, and audited operational changes without losing tenant boundaries.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}

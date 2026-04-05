"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiConfig } from "../api-config";
import { getAdminSession, logoutAdmin } from "../auth-client";
import { isDemoModeEnabled } from "../demo-mode";

type StudentState = {
  attendancePercentage: number;
  totalPublishedResults: number;
  averageGpa: number;
  nextCourse: string;
  totalPaid: number;
  pendingPayments: number;
  notifications: Array<{ id: string; title: string; message: string; createdAtUtc: string }>;
};

const demoState: StudentState = {
  attendancePercentage: 83,
  totalPublishedResults: 2,
  averageGpa: 8.8,
  nextCourse: "Distributed Systems",
  totalPaid: 57000,
  pendingPayments: 1,
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

export default function StudentPage() {
  const [state, setState] = useState<StudentState>(demoState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const demoMode = isDemoModeEnabled();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (demoMode) {
          if (!cancelled) {
            setState(demoState);
            setError(null);
            setLoading(false);
          }
          return;
        }

        const session = await getAdminSession();
        const headers = {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        };

        const [attendanceResponse, resultSummaryResponse, academicResponse, financeResponse, notificationsResponse] = await Promise.all([
          fetch(`${apiConfig.attendance()}/api/v1/students/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.exam()}/api/v1/students/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/dashboard/summary`, { headers }),
          fetch(`${apiConfig.finance()}/api/v1/students/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}&pageSize=5`, { headers })
        ]);

        if (!attendanceResponse.ok || !resultSummaryResponse.ok || !academicResponse.ok || !financeResponse.ok || !notificationsResponse.ok) {
          throw new Error("Unable to load the student workspace.");
        }

        const [attendancePayload, resultSummaryPayload, academicPayload, financePayload, notificationsPayload] = await Promise.all([
          attendanceResponse.json(),
          resultSummaryResponse.json(),
          academicResponse.json(),
          financeResponse.json(),
          notificationsResponse.json()
        ]);

        if (!cancelled) {
          setState({
            attendancePercentage: attendancePayload?.percentage ?? 0,
            totalPublishedResults: resultSummaryPayload?.totalPublished ?? 0,
            averageGpa: resultSummaryPayload?.averageGpa ?? 0,
            nextCourse: academicPayload?.nextCourse?.title ?? "No class scheduled",
            totalPaid: financePayload?.totalPaid ?? 0,
            pendingPayments: financePayload?.pendingSessions ?? 0,
            notifications: notificationsPayload?.items ?? []
          });
          setError(null);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
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

  return (
    <main className="panel-grid min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(7,18,34,0.95),rgba(14,40,73,0.86)_58%,rgba(5,13,25,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Student workspace</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Results, payments, attendance, and the next academic move.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                This surface now uses student-specific summaries instead of tenant-level shortcuts, so the signals are closer to a real student cockpit.
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
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Published results</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.totalPublishedResults}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Student-specific published result cycles.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Average GPA</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.averageGpa.toFixed(2)}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">A clearer academic signal than raw grade tables alone.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Next course</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.nextCourse}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Immediate schedule awareness for daily planning.</p>
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Finance posture</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Payments are visible in the student flow now</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Total paid</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : formatMoney(state.totalPaid)}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Pending sessions</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.pendingPayments}</p>
              </div>
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
      </div>
    </main>
  );
}

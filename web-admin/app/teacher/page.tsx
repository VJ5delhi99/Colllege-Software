"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiConfig } from "../api-config";
import { getAdminSession, logoutAdmin } from "../auth-client";
import { isDemoModeEnabled } from "../demo-mode";

type TeacherState = {
  attendancePercentage: number;
  totalCourses: number;
  nextCourse: string;
  recentResults: number;
  teachingLoad: number;
  notifications: Array<{ id: string; title: string; message: string; createdAtUtc: string }>;
};

const demoState: TeacherState = {
  attendancePercentage: 88,
  totalCourses: 6,
  nextCourse: "Distributed Systems",
  recentResults: 2,
  teachingLoad: 4,
  notifications: [
    {
      id: "teacher-note-1",
      title: "Faculty meeting on curriculum modernization",
      message: "Department heads and professors are requested to join the review session.",
      createdAtUtc: "2026-04-04T16:00:00Z"
    },
    {
      id: "teacher-note-2",
      title: "Attendance recovery follow-up",
      message: "Physics attendance dipped below threshold in one section.",
      createdAtUtc: "2026-04-03T10:15:00Z"
    }
  ]
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export default function TeacherPage() {
  const [state, setState] = useState<TeacherState>(demoState);
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

        const [attendanceResponse, teacherSummaryResponse, resultsResponse, notificationsResponse] = await Promise.all([
          fetch(`${apiConfig.attendance()}/api/v1/analytics/summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.exam()}/api/v1/results/summary`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}&pageSize=5`, { headers })
        ]);

        if (!attendanceResponse.ok || !teacherSummaryResponse.ok || !resultsResponse.ok || !notificationsResponse.ok) {
          throw new Error("Unable to load the teacher workspace.");
        }

        const [attendancePayload, teacherSummaryPayload, resultsPayload, notificationsPayload] = await Promise.all([
          attendanceResponse.json(),
          teacherSummaryResponse.json(),
          resultsResponse.json(),
          notificationsResponse.json()
        ]);

        if (!cancelled) {
          setState({
            attendancePercentage: attendancePayload?.percentage ?? 0,
            totalCourses: teacherSummaryPayload?.totalCourses ?? 0,
            nextCourse: teacherSummaryPayload?.nextCourse?.title ?? "No class scheduled",
            recentResults: resultsPayload?.totalPublished ?? 0,
            teachingLoad: teacherSummaryPayload?.teachingLoad ?? 0,
            notifications: notificationsPayload?.items ?? []
          });
          setError(null);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unexpected teacher workspace error.");
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
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(31,16,5,0.95),rgba(78,44,13,0.82)_58%,rgba(24,13,5,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-amber-200">Teacher workspace</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Classes, attendance, notifications, and teaching load in one flow.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                This surface now uses teacher-specific academic summaries instead of generic tenant-wide academic shortcuts.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/portal" className="rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-100">
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
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Attendance health</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : `${state.attendancePercentage}%`}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">Spot low-performing cohorts before they become escalations.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Course load</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.totalCourses}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">Teacher-specific course ownership from the academic service.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Next class</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.nextCourse}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">The most immediate schedule cue for teaching flow.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Published result cycles</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.recentResults}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">Assessment publishing stays visible beside class delivery.</p>
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Teaching load</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Keep workload visible without admin-only noise</h2>
            <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-sm text-slate-400">Distinct teaching assignments</p>
              <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.teachingLoad}</p>
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Notifications</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Recent teacher-facing updates</h2>
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

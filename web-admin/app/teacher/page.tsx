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
};

const demoState: TeacherState = {
  attendancePercentage: 88,
  totalCourses: 6,
  nextCourse: "Distributed Systems",
  recentResults: 2
};

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

        const [attendanceResponse, academicResponse, resultsResponse] = await Promise.all([
          fetch(`${apiConfig.attendance()}/api/v1/analytics/summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/dashboard/summary`, { headers }),
          fetch(`${apiConfig.exam()}/api/v1/results/summary`, { headers })
        ]);

        if (!attendanceResponse.ok || !academicResponse.ok || !resultsResponse.ok) {
          throw new Error("Unable to load the teacher workspace.");
        }

        const [attendancePayload, academicPayload, resultsPayload] = await Promise.all([
          attendanceResponse.json(),
          academicResponse.json(),
          resultsResponse.json()
        ]);

        if (!cancelled) {
          setState({
            attendancePercentage: attendancePayload?.percentage ?? 0,
            totalCourses: academicPayload?.totalCourses ?? 0,
            nextCourse: academicPayload?.nextCourse?.title ?? "No class scheduled",
            recentResults: resultsPayload?.totalPublished ?? 0
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
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Classes, attendance, and outcome visibility for teaching staff.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Teaching workflows should stay centered on active classes and student momentum, not on admin-only navigation.
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

        {error ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-50">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Attendance health</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : `${state.attendancePercentage}%`}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">Spot low-performing cohorts before they become escalations.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Course load</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.totalCourses}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">Keep assigned teaching sections visible at a glance.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Next class</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.nextCourse}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">The most immediate schedule cue for teaching flow.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Published result cycles</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.recentResults}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">Assessment publishing stays visible without pretending the teacher is a student record owner.</p>
          </article>
        </section>
      </div>
    </main>
  );
}

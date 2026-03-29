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
};

const demoState: StudentState = {
  attendancePercentage: 83,
  totalPublishedResults: 2,
  averageGpa: 8.8,
  nextCourse: "CSE401"
};

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

        const [attendanceResponse, resultsResponse, academicResponse] = await Promise.all([
          fetch(`${apiConfig.attendance()}/api/v1/students/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.exam()}/api/v1/results/summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/dashboard/summary`, { headers })
        ]);

        if (!attendanceResponse.ok || !resultsResponse.ok || !academicResponse.ok) {
          throw new Error("Unable to load the student workspace.");
        }

        const [attendancePayload, resultsPayload, academicPayload] = await Promise.all([
          attendanceResponse.json(),
          resultsResponse.json(),
          academicResponse.json()
        ]);

        if (!cancelled) {
          setState({
            attendancePercentage: attendancePayload?.percentage ?? 0,
            totalPublishedResults: resultsPayload?.totalPublished ?? 0,
            averageGpa: resultsPayload?.averageGpa ?? 0,
            nextCourse: academicPayload?.nextCourse?.title ?? "No class scheduled"
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
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Results, attendance, and the next academic move.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                This surface prioritizes the student decisions that matter now instead of dropping learners into admin-oriented navigation.
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

        {error ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-50">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Attendance</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : `${state.attendancePercentage}%`}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Monitor attendance recovery before it impacts eligibility.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Published results</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.totalPublishedResults}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Keep exam progress visible without extra taps.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Average GPA</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.averageGpa.toFixed(2)}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">A clearer academic signal than raw grade tables alone.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Next course</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.nextCourse}</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/90">Immediate schedule awareness for daily student planning.</p>
          </article>
        </section>
      </div>
    </main>
  );
}

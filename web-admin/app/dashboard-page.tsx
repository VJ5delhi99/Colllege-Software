"use client";

import { useEffect, useState } from "react";
import { getAdminSession } from "./auth-client";
import { apiConfig } from "./api-config";
import { demoDashboardState } from "./demo-data";
import { isDemoModeEnabled } from "./demo-mode";

type DashboardState = {
  enrollment: number;
  attendancePercentage: number;
  feeCollection: number;
  announcements: number;
  latestAnnouncement: string;
  nextCourse: string;
};

const initialState: DashboardState = {
  enrollment: 0,
  attendancePercentage: 0,
  feeCollection: 0,
  announcements: 0,
  latestAnnouncement: "No announcement available",
  nextCourse: "No class scheduled"
};

const dashboardCacheKey = "university360.admin.dashboard";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(value);
}

export default function DashboardPage() {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingCache, setUsingCache] = useState(false);
  const demoMode = isDemoModeEnabled();

  useEffect(() => {
    const readCachedState = (): DashboardState | null => {
      if (typeof window === "undefined") {
        return null;
      }

      const raw = window.localStorage.getItem(dashboardCacheKey);
      if (!raw) {
        return null;
      }

      try {
        return JSON.parse(raw) as DashboardState;
      } catch {
        window.localStorage.removeItem(dashboardCacheKey);
        return null;
      }
    };

    const writeCachedState = (nextState: DashboardState) => {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(dashboardCacheKey, JSON.stringify(nextState));
    };

    if (demoMode) {
      setState(demoDashboardState);
      writeCachedState(demoDashboardState);
      setUsingCache(false);
      setError(null);
      setLoading(false);
      return;
    }

    getAdminSession()
      .then((session) =>
        Promise.all([
          fetch(`${apiConfig.identity()}/api/v1/users`, {
            headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId }
          }).then((response) => response.json()),
          fetch(`${apiConfig.attendance()}/api/v1/analytics/summary`, {
            headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId }
          }).then((response) => response.json()),
          fetch(`${apiConfig.finance()}/api/v1/payments/summary`, {
            headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId }
          }).then((response) => response.json()),
          fetch(`${apiConfig.communication()}/api/v1/dashboard/summary`, {
            headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId }
          }).then((response) => response.json()),
          fetch(`${apiConfig.academic()}/api/v1/dashboard/summary`, {
            headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId }
          }).then((response) => response.json())
        ])
      )
      .then(([users, attendance, finance, communication, academic]) => {
        const nextState = {
          enrollment: Array.isArray(users) ? users.length : 0,
          attendancePercentage: attendance?.percentage ?? 0,
          feeCollection: finance?.totalCollected ?? 0,
          announcements: communication?.total ?? 0,
          latestAnnouncement: communication?.latest?.title ?? "No announcement available",
          nextCourse: academic?.nextCourse?.title ?? "No class scheduled"
        };

        setState(nextState);
        writeCachedState(nextState);
        setUsingCache(false);
        setError(null);
      })
      .catch(() => {
        const cachedState = readCachedState();
        if (cachedState) {
          setState(cachedState);
          setUsingCache(true);
          setError("Live dashboard feeds are temporarily unavailable. Showing the last successful snapshot from local cache.");
          return;
        }

        setUsingCache(false);
        setError("Live dashboard feeds are temporarily unavailable and no cached snapshot is available yet.");
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      title: "Enrollment",
      value: loading ? "..." : state.enrollment.toLocaleString("en-IN"),
      note: usingCache ? "Cached campus population" : "Live user count",
      accent: "from-cyan-300/25 via-cyan-400/12 to-transparent"
    },
    {
      title: "Attendance",
      value: loading ? "..." : `${state.attendancePercentage}%`,
      note: usingCache ? "Cached attendance trend" : "Live attendance summary",
      accent: "from-emerald-300/25 via-emerald-400/12 to-transparent"
    },
    {
      title: "Fee Collection",
      value: loading ? "..." : `INR ${formatMoney(state.feeCollection)}`,
      note: usingCache ? "Cached fee recovery" : "Live paid transactions",
      accent: "from-amber-300/25 via-orange-400/12 to-transparent"
    },
    {
      title: "Announcements",
      value: loading ? "..." : state.announcements.toString(),
      note: usingCache ? "Cached communications volume" : "Published notices",
      accent: "from-fuchsia-300/25 via-pink-400/12 to-transparent"
    }
  ];

  return (
    <section className="mx-auto max-w-7xl pb-24">
      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(7,18,34,0.95),rgba(14,40,73,0.86)_58%,rgba(5,13,25,0.96))] p-6 shadow-[0_32px_100px_rgba(3,10,20,0.5)] sm:p-8">
          <div className="absolute inset-y-0 right-[-8%] hidden aspect-square w-[48%] rounded-full bg-cyan-300/10 blur-3xl lg:block" />
          <div className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-100">
                University360 Admin
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
                {demoMode ? "Demo Mode" : usingCache ? "Cached Snapshot" : "Live Command Center"}
              </span>
            </div>
            <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Cross-campus operations with one clear surface for action.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Track academic readiness, fee recovery, active announcements, and delivery cadence without forcing administrators through fragmented service dashboards.
            </p>

            {error ? (
              <div className="mt-6 rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm leading-6 text-amber-50">
                {error}
              </div>
            ) : null}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Status</p>
                <p className="mt-3 text-xl font-semibold text-white">{loading ? "Syncing" : demoMode ? "Demo" : usingCache ? "Cached" : error ? "Offline" : "Healthy"}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Latest Notice</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-100">{loading ? "Loading updates..." : state.latestAnnouncement}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Next Academic Pulse</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-100">{loading ? "Checking schedule..." : state.nextCourse}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(12,24,41,0.82)] shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="relative border-b border-white/10 px-6 py-5">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Institution Snapshot</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Graduation readiness and student momentum</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                A visual summary card for institutional messaging, outcomes, and campus confidence.
              </p>
            </div>
            <img
              src="/images/graduation-hero.svg"
              alt="Graduation caps and certificates raised in celebration"
              className="h-64 w-full object-cover sm:h-72"
            />
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(12,24,41,0.82)] shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="grid gap-0 md:grid-cols-[0.92fr_1.08fr]">
              <img
                src="/images/student-spotlight.svg"
                alt="Student holding notebooks and pointing toward highlighted campus updates"
                className="h-full min-h-[260px] w-full object-cover"
              />
              <div className="flex flex-col justify-center px-6 py-6">
                <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-300">Student Spotlight</p>
                <h3 className="mt-3 text-2xl font-semibold text-white">Design around what students need to do next.</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Prioritize results, fee actions, attendance recovery, and course readiness ahead of decorative filler.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.78)] px-5 py-5 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur"
          >
            <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${card.accent}`} />
            <div className="relative">
              <p className="text-sm font-medium text-slate-300">{card.title}</p>
              <p className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{card.value}</p>
              <p className="mt-3 text-sm leading-6 text-cyan-200/90">{card.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.78)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Campus Brief</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Live decision surface</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              {loading ? "Refreshing" : demoMode ? "Demo" : usingCache ? "Cached" : error ? "Offline" : "Realtime"}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-5">
              <p className="text-sm text-slate-400">Announcement priority</p>
              <p className="mt-4 text-xl font-semibold text-white">{loading ? "Loading..." : state.latestAnnouncement}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-5">
              <p className="text-sm text-slate-400">Next scheduled course</p>
              <p className="mt-4 text-xl font-semibold text-white">{loading ? "Loading..." : state.nextCourse}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.78)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Operator Notes</p>
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-sm font-medium text-white">Attendance health</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Current campus attendance is {loading ? "..." : `${state.attendancePercentage}%`}. Use the attendance module to drill into low-performing cohorts.
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-sm font-medium text-white">Finance pulse</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Collected fees total {loading ? "..." : `INR ${formatMoney(state.feeCollection)}`}. Finance and operations teams can coordinate from the same stack.
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-sm font-medium text-white">Enrollment scale</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The current enrollment surface reflects {loading ? "..." : state.enrollment.toLocaleString("en-IN")} active users across the seeded tenant view.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

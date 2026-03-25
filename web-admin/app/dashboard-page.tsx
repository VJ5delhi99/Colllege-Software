"use client";

import { useEffect, useState } from "react";
import { getAdminSession } from "./auth-client";
import { apiConfig } from "./api-config";

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

export default function DashboardPage() {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminSession()
      .then((session) =>
        Promise.all([
          fetch(`${apiConfig.identity()}/api/v1/users`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId } }).then((response) => response.json()),
          fetch(`${apiConfig.attendance()}/api/v1/analytics/summary`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId } }).then((response) => response.json()),
          fetch(`${apiConfig.finance()}/api/v1/payments/summary`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId } }).then((response) => response.json()),
          fetch(`${apiConfig.communication()}/api/v1/dashboard/summary`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId } }).then((response) => response.json()),
          fetch(`${apiConfig.academic()}/api/v1/dashboard/summary`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId } }).then((response) => response.json())
        ])
      )
      .then(([users, attendance, finance, communication, academic]) => {
        setState({
          enrollment: Array.isArray(users) ? users.length : 0,
          attendancePercentage: attendance?.percentage ?? 0,
          feeCollection: finance?.totalCollected ?? 0,
          announcements: communication?.total ?? 0,
          latestAnnouncement: communication?.latest?.title ?? "No announcement available",
          nextCourse: academic?.nextCourse?.title ?? "No class scheduled"
        });
        setError(null);
      })
      .catch(() => {
        setError("Dashboard services are unavailable. Configure the required environment variables and identity token flow.");
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { title: "Enrollment", value: state.enrollment.toLocaleString(), note: "Live user count" },
    { title: "Attendance", value: `${state.attendancePercentage}%`, note: "Live attendance summary" },
    { title: "Fee Collection", value: `INR ${state.feeCollection.toLocaleString()}`, note: "Live paid transactions" },
    { title: "Announcements", value: state.announcements.toString(), note: "Published notices" }
  ];

  return (
    <section className="mx-auto max-w-7xl">
      <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">University360 Admin</p>
      <h1 className="mt-4 text-5xl font-semibold">Enterprise command center</h1>
      <p className="mt-4 max-w-3xl text-slate-400">
        Cross-campus operations for academics, exams, finance, attendance, and institutional analytics.
      </p>

      {error ? <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-100">{error}</div> : null}

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-sm text-slate-400">{card.title}</p>
            <p className="mt-6 text-4xl font-semibold text-white">{loading ? "..." : card.value}</p>
            <p className="mt-3 text-sm text-cyan-300">{card.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-sm text-slate-400">Latest announcement</p>
          <p className="mt-4 text-2xl font-semibold text-white">{loading ? "Loading..." : state.latestAnnouncement}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-sm text-slate-400">Next scheduled course</p>
          <p className="mt-4 text-2xl font-semibold text-white">{loading ? "Loading..." : state.nextCourse}</p>
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiConfig } from "../api-config";
import { getAdminSession, logoutAdmin } from "../auth-client";
import { isDemoModeEnabled } from "../demo-mode";

type AdminState = {
  userCount: number;
  feeCollection: number;
  auditCount: number;
  announcementCount: number;
  campusCount: number;
  programCount: number;
  inquiryCount: number;
};

const demoState: AdminState = {
  userCount: 2480,
  feeCollection: 57000,
  auditCount: 18,
  announcementCount: 6,
  campusCount: 3,
  programCount: 6,
  inquiryCount: 12
};

function formatMoney(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

export default function AdminPage() {
  const [state, setState] = useState<AdminState>(demoState);
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

        const [usersResponse, financeResponse, communicationResponse, identityAuditResponse, catalogResponse, inquirySummaryResponse] = await Promise.all([
          fetch(`${apiConfig.identity()}/api/v1/users`, { headers }),
          fetch(`${apiConfig.finance()}/api/v1/payments/summary`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/dashboard/summary`, { headers }),
          fetch(`${apiConfig.identity()}/api/v1/audit-logs?pageSize=20`, { headers }),
          fetch(`${apiConfig.organization()}/api/v1/catalog/summary`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/admissions/summary`, { headers })
        ]);

        if (!usersResponse.ok || !financeResponse.ok || !communicationResponse.ok || !identityAuditResponse.ok || !catalogResponse.ok || !inquirySummaryResponse.ok) {
          throw new Error("Unable to load the admin workspace.");
        }

        const [usersPayload, financePayload, communicationPayload, identityAuditPayload, catalogPayload, inquirySummaryPayload] = await Promise.all([
          usersResponse.json(),
          financeResponse.json(),
          communicationResponse.json(),
          identityAuditResponse.json(),
          catalogResponse.json(),
          inquirySummaryResponse.json()
        ]);

        if (!cancelled) {
          setState({
            userCount: Array.isArray(usersPayload) ? usersPayload.length : 0,
            feeCollection: financePayload?.totalCollected ?? 0,
            auditCount: identityAuditPayload?.items?.length ?? 0,
            announcementCount: communicationPayload?.total ?? 0,
            campusCount: catalogPayload?.campuses ?? 0,
            programCount: catalogPayload?.programs ?? 0,
            inquiryCount: inquirySummaryPayload?.total ?? 0
          });
          setError(null);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unexpected admin workspace error.");
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
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(17,7,34,0.95),rgba(42,14,73,0.86)_58%,rgba(10,5,25,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-fuchsia-300">Admin workspace</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Institution-wide control with public-to-ops visibility.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                The admin view now carries catalog coverage and admissions demand beside identity, finance, and communication signals.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/ops" className="rounded-full bg-fuchsia-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-200">
                Open Operations Hub
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
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Visible users</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.userCount}</p>
            <p className="mt-3 text-sm leading-6 text-fuchsia-100/90">Cross-campus identity scope in the current tenant.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Fee collection</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : formatMoney(state.feeCollection)}</p>
            <p className="mt-3 text-sm leading-6 text-fuchsia-100/90">A finance signal that belongs next to admin oversight.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Campuses | Programs</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : `${state.campusCount} | ${state.programCount}`}</p>
            <p className="mt-3 text-sm leading-6 text-fuchsia-100/90">Live public catalog coverage carried into the admin view.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Admissions inquiries</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.inquiryCount}</p>
            <p className="mt-3 text-sm leading-6 text-fuchsia-100/90">Inbound demand from the refreshed public experience.</p>
          </article>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-3">
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Identity audit events</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.auditCount}</p>
            <p className="mt-3 text-sm leading-6 text-fuchsia-100/90">Operational traceability around sessions and access changes.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Announcements</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.announcementCount}</p>
            <p className="mt-3 text-sm leading-6 text-fuchsia-100/90">Public and internal communication stays visible beside controls.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Control direction</p>
            <p className="mt-4 text-xl font-semibold text-white">From homepage signal to ops follow-up</p>
            <p className="mt-3 text-sm leading-6 text-fuchsia-100/90">The product now expresses a fuller journey instead of isolated role pages.</p>
          </article>
        </section>
      </div>
    </main>
  );
}

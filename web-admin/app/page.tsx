import Link from "next/link";
import DashboardPage from "./dashboard-page";
import ChatWidget from "./chat-widget";
import { isDemoModeEnabled } from "./demo-mode";

export default function HomePage() {
  const demoMode = isDemoModeEnabled();

  return (
    <main className="panel-grid min-h-screen overflow-x-hidden px-4 py-4 text-slate-100 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-[rgba(8,20,36,0.82)] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-cyan-300/90">University360</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-white sm:text-3xl">Operations Control Deck</h1>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-emerald-200">
                  {demoMode ? "Demo Ready" : "Local Stack Ready"}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
                Unified oversight for academics, attendance, exams, finance, and institutional coordination across the entire campus network.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                {demoMode ? "Local fixtures active" : "Gateway `7015`"}
              </div>
              <Link
                href="/rbac"
                className="rounded-full border border-cyan-400/30 bg-cyan-500/12 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/18"
              >
                Open RBAC Console
              </Link>
            </div>
          </div>
        </header>
      </div>
      <DashboardPage />
      <ChatWidget />
    </main>
  );
}

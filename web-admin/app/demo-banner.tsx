"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getDemoConfiguration, isDemoModeEnabled } from "./demo-mode";
import { resetDemoDataset } from "./demo-runtime";
import { resetDataServiceCache } from "./data-service";

export default function DemoBanner() {
  const [resetting, setResetting] = useState(false);
  const config = useMemo(() => getDemoConfiguration(), []);

  if (!isDemoModeEnabled()) {
    return null;
  }

  async function handleReset() {
    setResetting(true);
    resetDemoDataset();
    resetDataServiceCache();
    window.location.reload();
  }

  return (
    <div className="border-b border-amber-300/20 bg-amber-400/10 px-4 py-3 text-amber-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold uppercase tracking-[0.18em]">You are in Demo Mode</p>
          <p className="mt-1 text-amber-100/90">
            Mock services are active, all changes are temporary, and local demo data auto-resets every {Math.round(config.resetAfterMs / 3600000)} hours.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/demo-admin" className="rounded-full border border-amber-100/20 bg-amber-50/10 px-4 py-2 font-medium text-white">
            Open Demo Data Lab
          </Link>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="rounded-full bg-amber-200 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60"
          >
            {resetting ? "Resetting..." : "Reset Demo"}
          </button>
        </div>
      </div>
    </div>
  );
}

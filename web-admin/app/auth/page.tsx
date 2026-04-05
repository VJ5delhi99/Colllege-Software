"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  confirmEmailVerification,
  confirmPasswordReset,
  loginAdmin,
  requestPasswordReset,
  sendEmailVerification
} from "../auth-client";
import { demoUserAccounts } from "../demo-data";
import { isDemoModeEnabled } from "../demo-mode";

type AuthMode = "login" | "reset-request" | "reset-confirm" | "verify-send" | "verify-confirm";

const modes: { id: AuthMode; label: string; description: string }[] = [
  { id: "login", label: "Sign In", description: "Access the platform with your tenant, password, and optional MFA code." },
  { id: "reset-request", label: "Request Reset", description: "Send a password reset code to your registered email address." },
  { id: "reset-confirm", label: "Reset Password", description: "Confirm your reset code and set a new password." },
  { id: "verify-send", label: "Send Verification", description: "Request a new email verification code." },
  { id: "verify-confirm", label: "Verify Email", description: "Confirm the verification code sent to your inbox." }
];

export default function AuthPage() {
  const demoMode = isDemoModeEnabled();
  const [mode, setMode] = useState<AuthMode>("login");
  const [tenantId, setTenantId] = useState("default");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeMode = useMemo(() => modes.find((item) => item.id === mode) ?? modes[0], [mode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "login") {
        await loginAdmin({ email, password, tenantId, mfaCode: mfaCode || undefined });
        setMessage("Sign-in successful. Redirecting to the role portal...");
        window.setTimeout(() => {
          window.location.href = "/portal";
        }, 400);
        return;
      }

      if (mode === "reset-request") {
        const result = await requestPasswordReset(email, tenantId);
        setMessage(result.message);
        return;
      }

      if (mode === "reset-confirm") {
        const result = await confirmPasswordReset(email, resetCode, newPassword, tenantId);
        setMessage(result.message);
        return;
      }

      if (mode === "verify-send") {
        const result = await sendEmailVerification(email, tenantId);
        setMessage(result.message);
        return;
      }

      const result = await confirmEmailVerification(email, verificationCode, tenantId);
      setMessage(result.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected authentication error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="panel-grid min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(7,18,34,0.95),rgba(14,40,73,0.86)_58%,rgba(5,13,25,0.96))] p-6 shadow-[0_32px_100px_rgba(3,10,20,0.5)] sm:p-8">
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Identity Access</p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Secure entry for admins, faculty, and staff.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            Use your tenant-aware credentials to sign in, recover access, or complete email verification. This page replaces the scaffold-only hidden login behavior.
          </p>

          {demoMode ? (
            <div className="mt-6 rounded-[1.3rem] border border-cyan-300/20 bg-cyan-400/10 px-4 py-4 text-sm text-cyan-50">
              <p className="font-semibold uppercase tracking-[0.18em]">Demo Credentials</p>
              <div className="mt-3 space-y-2 text-cyan-100/90">
                {demoUserAccounts.map((user) => (
                  <p key={user.id}>
                    {user.role}: {user.email} / {user.password}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-8 grid gap-3">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode(item.id);
                  setError(null);
                  setMessage(null);
                }}
                className={`rounded-[1.3rem] border px-4 py-4 text-left transition ${
                  item.id === mode
                    ? "border-cyan-300/30 bg-cyan-400/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8"
                }`}
              >
                <p className="text-sm font-medium">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
              Back to Homepage
            </Link>
            <Link href="/portal" className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15">
              Open Role Portal
            </Link>
            <Link href="/ops" className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15">
              Open Operations Hub
            </Link>
            <Link href="/rbac" className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15">
              Open RBAC Console
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-200">{activeMode.label}</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{activeMode.description}</h2>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Tenant ID</span>
              <input
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
                className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                placeholder="default"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                placeholder="name@college.edu"
                required
              />
            </label>

            {mode === "login" ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    placeholder="Enter your password"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">MFA Code</span>
                  <input
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                    className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    placeholder="Optional unless MFA is enabled"
                  />
                </label>
              </>
            ) : null}

            {mode === "reset-confirm" ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">Reset Code</span>
                  <input
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value)}
                    className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    placeholder="Enter the code from email"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">New Password</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    placeholder="Enter a strong new password"
                    required
                  />
                </label>
              </>
            ) : null}

            {mode === "verify-confirm" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Verification Code</span>
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                  placeholder="Enter the code from email"
                  required
                />
              </label>
            ) : null}

            {error ? (
              <div className="rounded-[1.1rem] border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-[1.1rem] border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Processing..." : activeMode.label}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

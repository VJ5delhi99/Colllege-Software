import Link from "next/link";
import DashboardPage from "./dashboard-page";
import ChatWidget from "./chat-widget";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto mb-6 flex max-w-7xl justify-end">
        <Link href="/rbac" className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
          Open RBAC Console
        </Link>
      </div>
      <DashboardPage />
      <ChatWidget />
    </main>
  );
}

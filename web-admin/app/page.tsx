import DashboardPage from "./dashboard-page";
import ChatWidget from "./chat-widget";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <DashboardPage />
      <ChatWidget />
    </main>
  );
}

"use client";

import { useState } from "react";
import { getAdminSession } from "./auth-client";
import { apiConfig } from "./api-config";
import { getDemoAssistantReply } from "./demo-data";
import { isDemoModeEnabled } from "./demo-mode";
import { getPublicAssistantReply } from "./public-chatbot";

type ChatMode = "admin" | "public";

type ChatWidgetProps = {
  mode?: ChatMode;
  title?: string;
  subtitle?: string;
  suggestedPrompts?: string[];
  launcherLabel?: string;
  welcomeMessage?: string;
};

const defaultPrompts: Record<ChatMode, string[]> = {
  admin: [
    "Show university performance analytics",
    "Publish announcement",
    "View department results"
  ],
  public: [
    "How do I apply for admission?",
    "Which campuses offer engineering?",
    "How can I contact admissions?"
  ]
};

export default function ChatWidget({
  mode = "admin",
  title,
  subtitle,
  suggestedPrompts,
  launcherLabel,
  welcomeMessage
}: ChatWidgetProps) {
  const demoMode = isDemoModeEnabled();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: welcomeMessage
        ?? (mode === "public"
          ? "Ask about admissions, courses, campuses, scholarships, or contact support."
          : "Ask for analytics, announcements, or role-based ERP actions.")
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endpoint = apiConfig.assistant();
  const prompts = suggestedPrompts ?? defaultPrompts[mode];

  const send = async (message: string) => {
    if (!message.trim()) {
      return;
    }

    setMessages((current) => [...current, { id: `${Date.now()}-user`, role: "user", text: message }]);
    setInput("");
    setLoading(true);

    try {
      if (mode === "public") {
        const text = getPublicAssistantReply(message);
        setMessages((current) => [...current, { id: `${Date.now()}-assistant`, role: "assistant", text }]);
        return;
      }

      if (demoMode) {
        const text = getDemoAssistantReply(message);
        setMessages((current) => [...current, { id: `${Date.now()}-assistant`, role: "assistant", text }]);
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          message,
          userId: session.user.id
        })
      });

      const payload = await response.json().catch(() => null);
      const text = response.ok && payload?.reply
        ? payload.reply
        : "Assistant service is unreachable or rejected the request. Verify API URLs and identity token issuance.";

      setMessages((current) => [...current, { id: `${Date.now()}-assistant`, role: "assistant", text }]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: mode === "public"
            ? "The admissions assistant is temporarily unavailable. Please use the contact details in the footer."
            : "Assistant service is unreachable or rejected the request. Verify API URLs and identity token issuance."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="w-[360px] rounded-[28px] border border-cyan-200/20 bg-slate-950/95 p-4 shadow-2xl shadow-cyan-950 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                {title ?? (mode === "public" ? "Admissions Assistant" : "AI Assistant")}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {subtitle ?? (mode === "public"
                  ? "Guest support for admissions and campus discovery"
                  : demoMode
                    ? "University360 admin copilot demo"
                    : "University360 admin copilot")}
              </p>
            </div>
            <button className="text-slate-400" onClick={() => setOpen(false)}>Close</button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => send(prompt)}
                disabled={loading}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-cyan-100"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  message.role === "assistant"
                    ? "bg-white/5 text-slate-100"
                    : "ml-auto bg-cyan-400 text-slate-950"
                }`}
              >
                {message.text}
              </div>
            ))}
            {loading ? <div className="max-w-[85%] rounded-2xl bg-white/5 px-4 py-3 text-sm text-cyan-200">AI is typing...</div> : null}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={mode === "public" ? "Ask about admissions..." : "Ask AI assistant..."}
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              Send
            </button>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((value) => !value)}
        className="ml-auto rounded-full bg-cyan-300 px-5 py-4 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-950/30"
      >
        {launcherLabel ?? (mode === "public" ? "Ask Admissions" : "Ask AI")}
      </button>
    </div>
  );
}

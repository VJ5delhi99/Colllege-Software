import { apiConfig } from "./api-config";

type AuthSession = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
};

const SESSION_KEY = "university360_admin_session";

export async function getAdminSession(): Promise<AuthSession> {
  if (typeof window !== "undefined") {
    const cached = window.sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      return JSON.parse(cached) as AuthSession;
    }
  }

  const response = await fetch(`${apiConfig.identity()}/api/v1/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "principal@university360.edu", tenantId: "default" })
  });

  if (!response.ok) {
    throw new Error("Unable to obtain admin token");
  }

  const session = (await response.json()) as AuthSession;
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return session;
}

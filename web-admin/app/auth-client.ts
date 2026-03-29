import { apiConfig } from "./api-config";
import { demoSession } from "./demo-data";
import { getDataService } from "./data-service";
import { isDemoModeEnabled } from "./demo-mode";

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  fullName: string;
  permissions: string[];
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
};

export type LoginInput = {
  email: string;
  password: string;
  tenantId?: string;
  mfaCode?: string;
  passwordlessCode?: string;
};

const SESSION_KEY = "university360_admin_session";

function toSession(payload: Omit<AuthSession, "user"> & { email: string; role: string; tenantId: string }): AuthSession {
  return {
    ...payload,
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId
    }
  };
}

export function setAdminSession(session: AuthSession) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function clearAdminSession() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(SESSION_KEY);
  }
}

export async function getAdminSession(): Promise<AuthSession> {
  if (typeof window !== "undefined") {
    const cached = window.sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      return JSON.parse(cached) as AuthSession;
    }
  }

  if (isDemoModeEnabled()) {
    const session: AuthSession = {
      ...demoSession,
      user: {
        id: demoSession.userId,
        email: demoSession.email,
        role: demoSession.role,
        tenantId: demoSession.tenantId
      }
    };

    setAdminSession(session);
    return session;
  }

  throw new Error(`No admin session is available. Authenticate through the identity flow and persist the session under ${SESSION_KEY}.`);
}

export async function loginAdmin(input: LoginInput): Promise<AuthSession> {
  if (isDemoModeEnabled()) {
    const demoUsers = await getDataService().getDemoUsers();
    const matchedUser = demoUsers.find((user) => user.email.toLowerCase() === input.email.trim().toLowerCase() && user.password === input.password);
    if (!matchedUser) {
      throw new Error("Demo login failed. Use one of the seeded demo credentials.");
    }

    const session = toSession({
      accessToken: `demo-access-token-${matchedUser.id}`,
      refreshToken: `demo-refresh-token-${matchedUser.id}`,
      userId: matchedUser.id,
      fullName: matchedUser.fullName,
      permissions: matchedUser.permissions,
      email: matchedUser.email,
      role: matchedUser.role,
      tenantId: matchedUser.tenantId
    });

    setAdminSession(session);
    return session;
  }

  const response = await fetch(`${apiConfig.identity()}/api/v1/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      tenantId: input.tenantId ?? "default",
      mfaCode: input.mfaCode,
      passwordlessCode: input.passwordlessCode
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(payload?.message ?? "Unable to sign in.");
  }

  const session = toSession(payload as Omit<AuthSession, "user"> & { email: string; role: string; tenantId: string });
  setAdminSession(session);
  return session;
}

export async function logoutAdmin() {
  if (isDemoModeEnabled()) {
    clearAdminSession();
    return;
  }

  const session = await getAdminSession().catch(() => null);
  if (session) {
    await fetch(`${apiConfig.identity()}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken })
    }).catch(() => null);
  }

  clearAdminSession();
}

export async function requestPasswordReset(email: string, tenantId = "default") {
  if (isDemoModeEnabled()) {
    return { message: `Demo reset code issued for ${email} in tenant ${tenantId}.` };
  }

  const response = await fetch(`${apiConfig.identity()}/api/v1/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, tenantId })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to request password reset.");
  }

  return payload as { message: string };
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string, tenantId = "default") {
  if (isDemoModeEnabled()) {
    if (code.trim().length < 4 || newPassword.trim().length < 6) {
      throw new Error("Demo validation failed. Use a valid code and stronger password.");
    }

    return { message: `Demo password updated for ${email} in tenant ${tenantId}.` };
  }

  const response = await fetch(`${apiConfig.identity()}/api/v1/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword, tenantId })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to reset password.");
  }

  return payload as { message: string };
}

export async function sendEmailVerification(email: string, tenantId = "default") {
  if (isDemoModeEnabled()) {
    return { message: `Demo verification code issued for ${email} in tenant ${tenantId}.` };
  }

  const response = await fetch(`${apiConfig.identity()}/api/v1/auth/email-verification/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, tenantId })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to send verification code.");
  }

  return payload as { message: string };
}

export async function confirmEmailVerification(email: string, code: string, tenantId = "default") {
  if (isDemoModeEnabled()) {
    if (code.trim().length < 4) {
      throw new Error("Demo verification code is invalid.");
    }

    return { message: `Demo email verified for ${email} in tenant ${tenantId}.` };
  }

  const response = await fetch(`${apiConfig.identity()}/api/v1/auth/email-verification/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, tenantId })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to verify email.");
  }

  return payload as { message: string };
}

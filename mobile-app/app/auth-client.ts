import { apiConfig } from "./api-config";

type StudentSession = {
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

let cachedSession: StudentSession | null = null;

export async function getStudentSession(): Promise<StudentSession> {
  if (cachedSession) {
    return cachedSession;
  }

  const response = await fetch(`${apiConfig.identity()}/api/v1/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "student@university360.edu", tenantId: "default", password: "student-pass" })
  });

  if (!response.ok) {
    throw new Error("Unable to obtain student token");
  }

  const payload = (await response.json()) as Omit<StudentSession, "user"> & { email: string; role: string; tenantId: string };
  cachedSession = {
    ...payload,
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId
    }
  };
  return cachedSession;
}

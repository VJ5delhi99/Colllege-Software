import { apiConfig } from "./api-config";

type StudentSession = {
  accessToken: string;
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
    body: JSON.stringify({ email: "student@university360.edu", tenantId: "default" })
  });

  if (!response.ok) {
    throw new Error("Unable to obtain student token");
  }

  cachedSession = (await response.json()) as StudentSession;
  return cachedSession;
}

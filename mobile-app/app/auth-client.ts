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
const SESSION_KEY = "university360_student_session";

export function setStudentSession(session: StudentSession) {
  cachedSession = session;
}

export function clearStudentSession() {
  cachedSession = null;
}

export async function getStudentSession(): Promise<StudentSession> {
  if (cachedSession) {
    return cachedSession;
  }

  throw new Error(`No student session is available. Authenticate through the identity flow and hydrate ${SESSION_KEY}.`);
}

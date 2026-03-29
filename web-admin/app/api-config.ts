const defaults = {
  NEXT_PUBLIC_IDENTITY_API_URL: "http://localhost:7001",
  NEXT_PUBLIC_STUDENT_API_URL: "http://localhost:7008",
  NEXT_PUBLIC_AUTHORIZATION_API_URL: "http://localhost:7016",
  NEXT_PUBLIC_ACADEMIC_API_URL: "http://localhost:7002",
  NEXT_PUBLIC_ATTENDANCE_API_URL: "http://localhost:7003",
  NEXT_PUBLIC_COMMUNICATION_API_URL: "http://localhost:7004",
  NEXT_PUBLIC_EXAM_API_URL: "http://localhost:7005",
  NEXT_PUBLIC_FINANCE_API_URL: "http://localhost:7006",
  NEXT_PUBLIC_AI_ASSISTANT_URL: "http://localhost:7007/api/chat"
} as const;

function getEnv(name: keyof typeof defaults): string {
  const value = process.env[name];
  return value || defaults[name];
}

export const apiConfig = {
  identity: () => getEnv("NEXT_PUBLIC_IDENTITY_API_URL"),
  student: () => getEnv("NEXT_PUBLIC_STUDENT_API_URL"),
  authorization: () => getEnv("NEXT_PUBLIC_AUTHORIZATION_API_URL"),
  academic: () => getEnv("NEXT_PUBLIC_ACADEMIC_API_URL"),
  attendance: () => getEnv("NEXT_PUBLIC_ATTENDANCE_API_URL"),
  communication: () => getEnv("NEXT_PUBLIC_COMMUNICATION_API_URL"),
  exam: () => getEnv("NEXT_PUBLIC_EXAM_API_URL"),
  finance: () => getEnv("NEXT_PUBLIC_FINANCE_API_URL"),
  assistant: () => getEnv("NEXT_PUBLIC_AI_ASSISTANT_URL")
};

const defaults = {
  EXPO_PUBLIC_IDENTITY_API_URL: "http://localhost:7001",
  EXPO_PUBLIC_ACADEMIC_API_URL: "http://localhost:7002",
  EXPO_PUBLIC_ATTENDANCE_API_URL: "http://localhost:7003",
  EXPO_PUBLIC_COMMUNICATION_API_URL: "http://localhost:7004",
  EXPO_PUBLIC_EXAM_API_URL: "http://localhost:7005",
  EXPO_PUBLIC_FINANCE_API_URL: "http://localhost:7006",
  EXPO_PUBLIC_AI_ASSISTANT_URL: "http://localhost:7007/api/chat"
} as const;

function getEnv(name: keyof typeof defaults): string {
  const value = process.env[name];
  return value || defaults[name];
}

export const apiConfig = {
  identity: () => getEnv("EXPO_PUBLIC_IDENTITY_API_URL"),
  academic: () => getEnv("EXPO_PUBLIC_ACADEMIC_API_URL"),
  attendance: () => getEnv("EXPO_PUBLIC_ATTENDANCE_API_URL"),
  communication: () => getEnv("EXPO_PUBLIC_COMMUNICATION_API_URL"),
  exam: () => getEnv("EXPO_PUBLIC_EXAM_API_URL"),
  finance: () => getEnv("EXPO_PUBLIC_FINANCE_API_URL"),
  assistant: () => getEnv("EXPO_PUBLIC_AI_ASSISTANT_URL")
};

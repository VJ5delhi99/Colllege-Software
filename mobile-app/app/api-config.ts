export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const apiConfig = {
  identity: () => requireEnv("EXPO_PUBLIC_IDENTITY_API_URL"),
  academic: () => requireEnv("EXPO_PUBLIC_ACADEMIC_API_URL"),
  attendance: () => requireEnv("EXPO_PUBLIC_ATTENDANCE_API_URL"),
  communication: () => requireEnv("EXPO_PUBLIC_COMMUNICATION_API_URL"),
  exam: () => requireEnv("EXPO_PUBLIC_EXAM_API_URL"),
  assistant: () => requireEnv("EXPO_PUBLIC_AI_ASSISTANT_URL")
};

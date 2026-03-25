export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const apiConfig = {
  identity: () => requireEnv("NEXT_PUBLIC_IDENTITY_API_URL"),
  authorization: () => requireEnv("NEXT_PUBLIC_AUTHORIZATION_API_URL"),
  academic: () => requireEnv("NEXT_PUBLIC_ACADEMIC_API_URL"),
  attendance: () => requireEnv("NEXT_PUBLIC_ATTENDANCE_API_URL"),
  communication: () => requireEnv("NEXT_PUBLIC_COMMUNICATION_API_URL"),
  finance: () => requireEnv("NEXT_PUBLIC_FINANCE_API_URL"),
  assistant: () => requireEnv("NEXT_PUBLIC_AI_ASSISTANT_URL")
};

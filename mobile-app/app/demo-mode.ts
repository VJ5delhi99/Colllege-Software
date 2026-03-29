const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isDemoModeEnabled() {
  return process.env.EXPO_PUBLIC_DEMO_MODE === "true";
}

export function getDemoResetWindowMs() {
  return RESET_WINDOW_MS;
}

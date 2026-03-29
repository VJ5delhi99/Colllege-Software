const DEMO_MODE_FLAG = "NEXT_PUBLIC_DEMO_MODE";
const DEMO_OVERRIDE_KEY = "university360.demo.override";
const DEMO_RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DemoConfiguration = {
  enabled: boolean;
  source: "environment" | "local-override";
  resetAfterMs: number;
};

function readLocalOverride() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(DEMO_OVERRIDE_KEY);
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

export function getDemoConfiguration(): DemoConfiguration {
  const override = readLocalOverride();
  if (override !== null) {
    return {
      enabled: override,
      source: "local-override",
      resetAfterMs: DEMO_RESET_WINDOW_MS
    };
  }

  return {
    enabled: process.env[DEMO_MODE_FLAG] === "true",
    source: "environment",
    resetAfterMs: DEMO_RESET_WINDOW_MS
  };
}

export function isDemoModeEnabled() {
  return getDemoConfiguration().enabled;
}

export function setDemoModeOverride(value: boolean | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (value === null) {
    window.localStorage.removeItem(DEMO_OVERRIDE_KEY);
    return;
  }

  window.localStorage.setItem(DEMO_OVERRIDE_KEY, value ? "true" : "false");
}

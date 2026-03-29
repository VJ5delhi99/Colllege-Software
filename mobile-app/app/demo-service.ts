import { mobileDemoDashboardState, mobileDemoSession, type MobileDashboardState } from "./demo-data";
import { getDemoResetWindowMs } from "./demo-mode";

let loadedAtUtc: string | null = null;
let dashboardState: MobileDashboardState = mobileDemoDashboardState;

async function simulateDelay() {
  const delay = 300 + Math.round(Math.random() * 500);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

function ensureFreshState() {
  if (!loadedAtUtc || Date.now() - new Date(loadedAtUtc).getTime() > getDemoResetWindowMs()) {
    loadedAtUtc = new Date().toISOString();
    dashboardState = mobileDemoDashboardState;
  }
}

export async function getMobileDemoSession() {
  ensureFreshState();
  await simulateDelay();
  return mobileDemoSession;
}

export async function getMobileDemoDashboard() {
  ensureFreshState();
  await simulateDelay();
  return dashboardState;
}

export async function resetMobileDemoData() {
  loadedAtUtc = new Date().toISOString();
  dashboardState = mobileDemoDashboardState;
  await simulateDelay();
}

export type DemoSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  fullName: string;
  permissions: string[];
  email: string;
  role: string;
  tenantId: string;
};

export type DemoDashboardState = {
  enrollment: number;
  attendancePercentage: number;
  feeCollection: number;
  announcements: number;
  latestAnnouncement: string;
  nextCourse: string;
};

export type DemoRoleDefinition = {
  id: string;
  name: string;
  description: string;
};

export type DemoPermissionDefinition = {
  id: string;
  name: string;
  description: string;
};

const demoReplies: Record<string, string> = {
  "show university performance analytics": "Campus attendance is at 94%, fee collection has reached INR 1,284,000, and three departments are above their monthly performance target.",
  "publish announcement": "Draft announcement ready: Mid-semester reviews open Monday at 9:00 AM. Add audience and approval details before publishing.",
  "view department results": "Computer Science leads the current cycle with a 91% pass rate. Mechanical Engineering is at 87%, and Civil Engineering is at 84%."
};

export const demoSession: DemoSession = {
  accessToken: "demo-access-token",
  refreshToken: "demo-refresh-token",
  userId: "00000000-0000-0000-0000-000000000999",
  fullName: "Prof. Kavita Menon",
  email: "principal@university360.edu",
  role: "Principal",
  tenantId: "default",
  permissions: ["analytics.view", "rbac.manage", "finance.manage"]
};

export const demoDashboardState: DemoDashboardState = {
  enrollment: 3240,
  attendancePercentage: 94,
  feeCollection: 1284000,
  announcements: 6,
  latestAnnouncement: "Mid-semester review schedule released for all departments",
  nextCourse: "Distributed Systems leadership briefing at 11:30 AM"
};

export const demoRoles: DemoRoleDefinition[] = [
  { id: "role-principal", name: "Principal", description: "Institution-wide governance, approvals, and strategic oversight." },
  { id: "role-professor", name: "Professor", description: "Academic delivery, course coordination, and evaluation workflows." },
  { id: "role-finance", name: "Finance Officer", description: "Fee operations, reconciliation, and payment exception handling." }
];

export const demoPermissions: DemoPermissionDefinition[] = [
  { id: "permission-analytics-view", name: "analytics.view", description: "View operational analytics and institutional summaries." },
  { id: "permission-rbac-manage", name: "rbac.manage", description: "Inspect and manage roles and permission assignments." },
  { id: "permission-finance-manage", name: "finance.manage", description: "Create, reconcile, and review fee collection activity." },
  { id: "permission-announcements-publish", name: "announcements.publish", description: "Create and publish campus-wide announcements." }
];

export function getDemoAssistantReply(message: string) {
  const normalized = message.trim().toLowerCase();
  return demoReplies[normalized] ?? "Demo mode is active. This assistant is using canned responses instead of the live AI backend.";
}

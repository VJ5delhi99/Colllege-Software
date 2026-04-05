export type MobileDemoSession = {
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

export type MobileDashboardState = {
  attendance: string;
  results: string;
  announcements: string;
  schedule: string;
  finance: string;
  enrollments: string;
  requests: string;
  principalBlogTitle: string;
  principalBlogBody: string;
  nextClassTitle: string;
  nextClassMeta: string;
  paymentTitle: string;
  paymentMeta: string;
  studentOpsTitle: string;
  studentOpsMeta: string;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    createdAtUtc: string;
  }>;
};

export const mobileDemoSession: MobileDemoSession = {
  accessToken: "demo-mobile-access-token",
  refreshToken: "demo-mobile-refresh-token",
  userId: "00000000-0000-0000-0000-000000000123",
  fullName: "Aarav Sharma",
  permissions: ["attendance.view", "results.view"],
  user: {
    id: "00000000-0000-0000-0000-000000000123",
    email: "student@university360.edu",
    role: "Student",
    tenantId: "default"
  }
};

export const mobileDemoDashboardState: MobileDashboardState = {
  attendance: "83%",
  results: "8.8 GPA",
  announcements: "3 New",
  schedule: "11:30 AM",
  finance: "INR 57K",
  enrollments: "3 Courses",
  requests: "2 Open",
  principalBlogTitle: "Mid-semester review schedule released",
  principalBlogBody: "The demo environment is showing seeded academic notices instead of the live campus communication feed.",
  nextClassTitle: "Distributed Systems",
  nextClassMeta: "B-204 - 11:30 AM - CSE401",
  paymentTitle: "Pending INV-2026-003",
  paymentMeta: "PayPal fee collection session is waiting for checkout completion.",
  studentOpsTitle: "Need bonafide letter for internship verification",
  studentOpsMeta: "Bonafide Letter | Submitted",
  notifications: [
    {
      id: "mobile-note-1",
      title: "Semester exams begin on April 12",
      message: "Review the updated exam timetable and hall policies before reporting.",
      createdAtUtc: "2026-04-04T09:30:00Z"
    },
    {
      id: "mobile-note-2",
      title: "Library hours extended",
      message: "Late-evening access is open through the assessment week.",
      createdAtUtc: "2026-04-03T17:00:00Z"
    },
    {
      id: "mobile-note-3",
      title: "Admissions counseling week is live",
      message: "Student ambassadors are supporting campus tours across all three locations.",
      createdAtUtc: "2026-04-02T10:15:00Z"
    }
  ]
};

const mobileReplies: Record<string, string> = {
  "check my attendance": "Demo attendance is 83%. Physics needs the most attention in the current sample semester.",
  "show my results": "Your seeded demo GPA is 8.8 and the latest published result snapshot is up to date.",
  "latest announcements": "The demo feed highlights review schedules, admissions sessions, and extended library hours.",
  "today's schedule": "Distributed Systems is the next class in the demo timetable."
};

export function getMobileDemoReply(message: string) {
  return mobileReplies[message.trim().toLowerCase()] ?? "Demo mode is active in the mobile app, so this reply is coming from seeded local data.";
}

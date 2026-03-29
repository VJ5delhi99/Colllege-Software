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

export type DemoStudent = {
  id: string;
  fullName: string;
  email: string;
  campusId: string;
  department: string;
  year: string;
  status: "Active" | "On Leave";
};

export type DemoTeacher = {
  id: string;
  fullName: string;
  email: string;
  campusId: string;
  department: string;
  specialization: string;
  status: "Active" | "Sabbatical";
};

export type DemoCampus = {
  id: string;
  name: string;
  location: string;
  deanName: string;
  studentCapacity: number;
};

export type DemoCourse = {
  id: string;
  courseCode: string;
  title: string;
  campusId: string;
  facultyId: string;
  semesterCode: string;
  room: string;
};

export type DemoAnnouncement = {
  id: string;
  title: string;
  message: string;
  audience: string;
  publishedOn: string;
};

export type DemoUserAccount = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: "Student" | "Professor" | "Principal";
  tenantId: string;
  permissions: string[];
};

export type DemoDataset = {
  generatedAtUtc: string;
  students: DemoStudent[];
  teachers: DemoTeacher[];
  campuses: DemoCampus[];
  courses: DemoCourse[];
  announcements: DemoAnnouncement[];
  demoUsers: DemoUserAccount[];
};

const demoReplies: Record<string, string> = {
  "show university performance analytics": "Campus attendance is at 94%, fee collection has reached INR 1,284,000, and three departments are above their monthly performance target.",
  "publish announcement": "Draft announcement ready: Mid-semester reviews open Monday at 9:00 AM. Add audience and approval details before publishing.",
  "view department results": "Computer Science leads the current cycle with a 91% pass rate. Mechanical Engineering is at 87%, and Civil Engineering is at 84%.",
  "check my attendance": "Demo attendance is currently 83%. Physics needs attention before the next review checkpoint.",
  "show my results": "Your latest demo GPA is 8.80 for the current published semester snapshot.",
  "latest announcements": "Admissions Q&A is live this Friday and the library has extended exam-week hours.",
  "today's schedule": "Distributed Systems is the next class on the demo schedule, followed by the AI workshop briefing."
};

export const demoUserAccounts: DemoUserAccount[] = [
  {
    id: "00000000-0000-0000-0000-000000000123",
    email: "student@university360.edu",
    password: "student-pass",
    fullName: "Aarav Sharma",
    role: "Student",
    tenantId: "default",
    permissions: ["attendance.view", "results.view"]
  },
  {
    id: "00000000-0000-0000-0000-000000000456",
    email: "professor@university360.edu",
    password: "professor-pass",
    fullName: "Dr. Meera Iyer",
    role: "Professor",
    tenantId: "default",
    permissions: ["attendance.view", "attendance.mark", "results.view", "announcements.create"]
  },
  {
    id: "00000000-0000-0000-0000-000000000999",
    email: "principal@university360.edu",
    password: "principal-pass",
    fullName: "Prof. Kavita Menon",
    role: "Principal",
    tenantId: "default",
    permissions: ["analytics.view", "rbac.manage", "finance.manage", "attendance.view", "results.view", "announcements.create"]
  }
];

export const demoSession: DemoSession = {
  accessToken: "demo-access-token",
  refreshToken: "demo-refresh-token",
  userId: demoUserAccounts[2].id,
  fullName: demoUserAccounts[2].fullName,
  email: demoUserAccounts[2].email,
  role: demoUserAccounts[2].role,
  tenantId: demoUserAccounts[2].tenantId,
  permissions: demoUserAccounts[2].permissions
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
  { id: "role-student", name: "Student", description: "Self-service academic tracking, notifications, and attendance visibility." }
];

export const demoPermissions: DemoPermissionDefinition[] = [
  { id: "permission-analytics-view", name: "analytics.view", description: "View operational analytics and institutional summaries." },
  { id: "permission-rbac-manage", name: "rbac.manage", description: "Inspect and manage roles and permission assignments." },
  { id: "permission-finance-manage", name: "finance.manage", description: "Create, reconcile, and review fee collection activity." },
  { id: "permission-announcements-create", name: "announcements.create", description: "Create and publish campus-wide announcements." },
  { id: "permission-attendance-view", name: "attendance.view", description: "Review attendance health and session summaries." },
  { id: "permission-results-view", name: "results.view", description: "Inspect published result summaries and GPA records." }
];

export function createDemoDataset(size: "small" | "medium" | "large" = "small"): DemoDataset {
  const campuses: DemoCampus[] = [
    { id: "campus-bengaluru", name: "Bengaluru Central Campus", location: "Bengaluru", deanName: "Dr. Nisha Rao", studentCapacity: 1800 },
    { id: "campus-mysuru", name: "Mysuru Lakeside Campus", location: "Mysuru", deanName: "Prof. Rahul Desai", studentCapacity: 1200 },
    { id: "campus-hyderabad", name: "Hyderabad Tech Campus", location: "Hyderabad", deanName: "Dr. Farah Khan", studentCapacity: 2200 }
  ];

  const students: DemoStudent[] = [
    { id: demoUserAccounts[0].id, fullName: "Aarav Sharma", email: demoUserAccounts[0].email, campusId: campuses[0].id, department: "Computer Science", year: "Year 4", status: "Active" },
    { id: "student-002", fullName: "Maya Reddy", email: "maya.reddy@university360.edu", campusId: campuses[1].id, department: "Electronics", year: "Year 3", status: "Active" },
    { id: "student-003", fullName: "Rohan Gupta", email: "rohan.gupta@university360.edu", campusId: campuses[2].id, department: "Civil", year: "Year 2", status: "On Leave" }
  ];

  const teachers: DemoTeacher[] = [
    { id: demoUserAccounts[1].id, fullName: "Dr. Meera Iyer", email: demoUserAccounts[1].email, campusId: campuses[0].id, department: "Computer Science", specialization: "Distributed Systems", status: "Active" },
    { id: "teacher-002", fullName: "Prof. Anita Verma", email: "anita.verma@university360.edu", campusId: campuses[1].id, department: "Mathematics", specialization: "Applied Statistics", status: "Active" },
    { id: "teacher-003", fullName: "Dr. Hassan Ali", email: "hassan.ali@university360.edu", campusId: campuses[2].id, department: "Mechanical", specialization: "Manufacturing Systems", status: "Sabbatical" }
  ];

  const courses: DemoCourse[] = [
    { id: "course-001", courseCode: "CSE401", title: "Distributed Systems", campusId: campuses[0].id, facultyId: teachers[0].id, semesterCode: "2026-SPRING", room: "B-204" },
    { id: "course-002", courseCode: "MTH301", title: "Advanced Mathematics", campusId: campuses[1].id, facultyId: teachers[1].id, semesterCode: "2026-SPRING", room: "A-112" },
    { id: "course-003", courseCode: "MEC221", title: "Robotics Workshop", campusId: campuses[2].id, facultyId: teachers[2].id, semesterCode: "2026-SPRING", room: "Lab-5" }
  ];

  const announcements: DemoAnnouncement[] = [
    { id: "announcement-001", title: "Mid-semester review schedule released", message: "All departments should complete review planning by Friday.", audience: "All", publishedOn: "2026-03-29T08:00:00Z" },
    { id: "announcement-002", title: "Admissions Q&A live session", message: "Guest users can join the admissions webinar on Friday at 5 PM.", audience: "Applicants", publishedOn: "2026-03-28T14:30:00Z" },
    { id: "announcement-003", title: "Library extended hours", message: "Central library will remain open until 11 PM during exam week.", audience: "Students", publishedOn: "2026-03-27T10:15:00Z" }
  ];

  if (size === "medium" || size === "large") {
    for (let index = 4; index <= (size === "medium" ? 12 : 30); index += 1) {
      students.push({
        id: `student-${index.toString().padStart(3, "0")}`,
        fullName: `Demo Student ${index}`,
        email: `student${index}@university360.edu`,
        campusId: campuses[index % campuses.length].id,
        department: index % 2 === 0 ? "Computer Science" : "Business Administration",
        year: `Year ${(index % 4) + 1}`,
        status: "Active"
      });
    }
  }

  return {
    generatedAtUtc: new Date().toISOString(),
    students,
    teachers,
    campuses,
    courses,
    announcements,
    demoUsers: demoUserAccounts
  };
}

export function getDemoAssistantReply(message: string) {
  const normalized = message.trim().toLowerCase();
  return demoReplies[normalized] ?? "Demo mode is active. This assistant is using realistic canned responses instead of the live AI backend.";
}

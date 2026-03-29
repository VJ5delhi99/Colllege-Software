export type QuickAccessLink = {
  title: string;
  description: string;
  href: string;
  eyebrow: string;
};

export type AnnouncementItem = {
  id: string;
  title: string;
  summary: string;
  badge: string;
  publishedOn: string;
};

export type CampusHighlight = {
  id: string;
  name: string;
  location: string;
  description: string;
  image: string;
  statLabel: string;
  statValue: string;
};

export const tickerItems = [
  "Admissions for the 2026-2027 academic year are open across all campuses.",
  "Scholarship interviews begin on April 12 with digital slot confirmation.",
  "Faculty recruitment for AI, Data Science, and Commerce departments is now live.",
  "Semester orientation week starts on June 15 for all first-year students."
];

export const quickAccessLinks: QuickAccessLink[] = [
  {
    title: "Student Login",
    description: "View timetable, assignments, results, and notifications.",
    href: "#student-dashboard",
    eyebrow: "Secure portal"
  },
  {
    title: "Teacher Login",
    description: "Manage classes, attendance, grading, and announcements.",
    href: "#teacher-dashboard",
    eyebrow: "Academic workspace"
  },
  {
    title: "Staff Login",
    description: "Access operations, admissions, and campus administration tools.",
    href: "#admin-dashboard",
    eyebrow: "Operations center"
  }
];

export const homepageAnnouncements: AnnouncementItem[] = [
  {
    id: "admissions-open",
    title: "Undergraduate admissions are now open",
    summary: "Applications are live for engineering, commerce, humanities, and science programs across all campuses.",
    badge: "Admissions",
    publishedOn: "March 28, 2026"
  },
  {
    id: "placement-drive",
    title: "Industry placement drive begins next month",
    summary: "More than 40 companies are scheduled for on-campus and hybrid recruitment sessions.",
    badge: "Placements",
    publishedOn: "March 24, 2026"
  },
  {
    id: "faculty-summit",
    title: "Teaching innovation summit scheduled",
    summary: "Faculty teams will present blended-learning pilots and student success initiatives from every college.",
    badge: "Academic Excellence",
    publishedOn: "March 20, 2026"
  }
];

export const campusHighlights: CampusHighlight[] = [
  {
    id: "north-campus",
    name: "North City Campus",
    location: "Bengaluru",
    description: "A technology-led campus with strong engineering, data science, and innovation lab infrastructure.",
    image: "/images/graduation-hero.svg",
    statLabel: "Programs",
    statValue: "42"
  },
  {
    id: "heritage-campus",
    name: "Heritage Arts Campus",
    location: "Mysuru",
    description: "A design-forward academic environment built for liberal arts, media, and interdisciplinary research.",
    image: "/images/student-spotlight.svg",
    statLabel: "Student clubs",
    statValue: "28"
  },
  {
    id: "health-campus",
    name: "Health Sciences Campus",
    location: "Chennai",
    description: "Home to allied health, biosciences, and community outreach programs with simulation-ready labs.",
    image: "/images/graduation-hero.svg",
    statLabel: "Labs",
    statValue: "19"
  }
];

export const stats = [
  { label: "Colleges", value: "12" },
  { label: "Campuses", value: "28" },
  { label: "Students", value: "48K+" },
  { label: "Placement partners", value: "420+" }
];

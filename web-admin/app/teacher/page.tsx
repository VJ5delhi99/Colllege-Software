"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiConfig } from "../api-config";
import { getAdminSession, logoutAdmin } from "../auth-client";
import { isDemoModeEnabled } from "../demo-mode";

type CourseItem = {
  id: string;
  courseCode: string;
  title: string;
  semesterCode: string;
  dayOfWeek: string;
  startTime: string;
  room: string;
};

type AttendanceAlert = {
  courseCode: string;
  percentage: number;
  totalRecords: number;
};

type AttendanceSessionItem = {
  id: string;
  courseCode: string;
  qrCode: string;
  status: string;
  startedAtUtc: string;
  closedAtUtc?: string | null;
};

type GradeReviewItem = {
  id: string;
  studentName: string;
  courseCode: string;
  assessmentName: string;
  status: string;
  reviewerNote: string;
};

type AdvisingNoteItem = {
  id: string;
  studentName: string;
  courseCode: string;
  title: string;
  note: string;
  followUpStatus: string;
  createdAtUtc: string;
};

type ContentDraftItem = {
  id: string;
  courseCode: string;
  draftType: string;
  title: string;
  status: string;
  updatedAtUtc: string;
};

type AssessmentPublicationItem = {
  id: string;
  courseCode: string;
  assessmentName: string;
  status: string;
  moderationNote: string;
  updatedAtUtc: string;
  publishedAtUtc?: string | null;
};

type OfficeHourItem = {
  id: string;
  courseCode: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location: string;
  deliveryMode: string;
  status: string;
};

type ClassCoverRequestItem = {
  id: string;
  courseCode: string;
  classDateUtc: string;
  reason: string;
  requestedCoverTeacher: string;
  status: string;
  adminNote: string;
  requestedAtUtc: string;
  reviewedAtUtc?: string | null;
};

type CoursePlanItem = {
  id: string;
  courseCode: string;
  title: string;
  coverage: string;
  status: string;
  reviewNote: string;
  updatedAtUtc: string;
  submittedAtUtc?: string | null;
  approvedAtUtc?: string | null;
};

type TimetableChangeItem = {
  id: string;
  courseCode: string;
  currentSlot: string;
  proposedSlot: string;
  reason: string;
  status: string;
  reviewNote: string;
  requestedAtUtc: string;
  reviewedAtUtc?: string | null;
};

type MentoringAssignmentItem = {
  id: string;
  studentName: string;
  batch: string;
  supportArea: string;
  riskLevel: string;
  status: string;
  nextMeetingAtUtc: string;
  lastContactAtUtc?: string | null;
};

type ExamBoardItem = {
  id: string;
  courseCode: string;
  assessmentName: string;
  boardName: string;
  panelLead: string;
  status: string;
  boardNote: string;
  dueAtUtc: string;
  updatedAtUtc: string;
  releasedAtUtc?: string | null;
};

type TeacherState = {
  attendancePercentage: number;
  totalCourses: number;
  nextCourse: string;
  teachingLoad: number;
  officeHoursScheduled: number;
  pendingClassCoverRequests: number;
  coursePlansAwaitingApproval: number;
  approvedCoursePlans: number;
  adviseeFollowUpsOpen: number;
  pendingTimetableChanges: number;
  mentoringStudents: number;
  mentoringAlerts: number;
  activeSessions: number;
  lowAttendanceCourses: number;
  lmsMaterials: number;
  lmsAssignments: number;
  gradingPending: number;
  gradingReady: number;
  ownedCourses: CourseItem[];
  alerts: AttendanceAlert[];
  sessions: AttendanceSessionItem[];
  gradeReviews: GradeReviewItem[];
  contentDrafts: ContentDraftItem[];
  publishingQueue: AssessmentPublicationItem[];
  advisingNotes: AdvisingNoteItem[];
  officeHours: OfficeHourItem[];
  classCoverRequests: ClassCoverRequestItem[];
  coursePlans: CoursePlanItem[];
  timetableChanges: TimetableChangeItem[];
  mentoringRoster: MentoringAssignmentItem[];
  examBoardItems: ExamBoardItem[];
  notifications: Array<{ id: string; title: string; message: string; createdAtUtc: string }>;
};

const demoState: TeacherState = {
  attendancePercentage: 88,
  totalCourses: 3,
  nextCourse: "Distributed Systems",
  teachingLoad: 3,
  officeHoursScheduled: 2,
  pendingClassCoverRequests: 1,
  coursePlansAwaitingApproval: 1,
  approvedCoursePlans: 1,
  adviseeFollowUpsOpen: 1,
  pendingTimetableChanges: 1,
  mentoringStudents: 2,
  mentoringAlerts: 1,
  activeSessions: 1,
  lowAttendanceCourses: 1,
  lmsMaterials: 2,
  lmsAssignments: 2,
  gradingPending: 1,
  gradingReady: 1,
  ownedCourses: [
    { id: "course-1", courseCode: "CSE401", title: "Distributed Systems", semesterCode: "2026-SPRING", dayOfWeek: "Monday", startTime: "02:00 PM", room: "B-204" },
    { id: "course-2", courseCode: "PHY201", title: "Physics", semesterCode: "2026-SPRING", dayOfWeek: "Tuesday", startTime: "10:00 AM", room: "Lab-2" },
    { id: "course-3", courseCode: "MTH301", title: "Advanced Mathematics", semesterCode: "2026-SPRING", dayOfWeek: "Wednesday", startTime: "11:30 AM", room: "A-112" }
  ],
  alerts: [
    { courseCode: "PHY201", percentage: 66.67, totalRecords: 3 },
    { courseCode: "CSE401", percentage: 100, totalRecords: 2 }
  ],
  sessions: [
    { id: "session-1", courseCode: "PHY201", qrCode: "QR-PHY201-1", status: "Active", startedAtUtc: "2026-04-05T09:00:00Z" },
    { id: "session-2", courseCode: "CSE401", qrCode: "QR-CSE401-9", status: "Closed", startedAtUtc: "2026-04-04T14:00:00Z", closedAtUtc: "2026-04-04T15:00:00Z" }
  ],
  gradeReviews: [
    { id: "grade-1", studentName: "Aarav Sharma", courseCode: "CSE401", assessmentName: "Lab Evaluation 1", status: "Pending Review", reviewerNote: "Need to double-check the replication diagram rubric." },
    { id: "grade-2", studentName: "Aarav Sharma", courseCode: "PHY201", assessmentName: "Internal Quiz 2", status: "Ready To Publish", reviewerNote: "Moderation completed." }
  ],
  contentDrafts: [
    { id: "draft-1", courseCode: "CSE401", draftType: "Module Outline", title: "Week 5 replication patterns", status: "Draft", updatedAtUtc: "2026-04-04T10:00:00Z" },
    { id: "draft-2", courseCode: "PHY201", draftType: "Assessment Brief", title: "Internal quiz moderation notes", status: "Review Ready", updatedAtUtc: "2026-04-05T08:00:00Z" }
  ],
  publishingQueue: [
    { id: "publish-1", courseCode: "CSE401", assessmentName: "Midterm Rubric", status: "Moderation Review", moderationNote: "Waiting for final rubric sign-off.", updatedAtUtc: "2026-04-04T12:00:00Z" },
    { id: "publish-2", courseCode: "PHY201", assessmentName: "Internal Quiz 2", status: "Ready To Publish", moderationNote: "Moderation completed and board-ready.", updatedAtUtc: "2026-04-05T09:00:00Z" }
  ],
  advisingNotes: [
    { id: "note-1", studentName: "Aarav Sharma", courseCode: "PHY201", title: "Attendance recovery plan", note: "Student should attend the next two lab sessions and submit the missed worksheet.", followUpStatus: "Open", createdAtUtc: "2026-04-03T09:30:00Z" },
    { id: "note-2", studentName: "Aarav Sharma", courseCode: "CSE401", title: "Exam readiness counseling", note: "Asked student to focus on replication strategies and consistency trade-offs before the review.", followUpStatus: "Closed", createdAtUtc: "2026-04-04T12:00:00Z" }
  ],
  officeHours: [
    { id: "office-1", courseCode: "CSE401", dayOfWeek: "Tuesday", startTime: "03:30 PM", endTime: "04:30 PM", location: "B-204", deliveryMode: "In Person", status: "Scheduled" },
    { id: "office-2", courseCode: "PHY201", dayOfWeek: "Thursday", startTime: "11:00 AM", endTime: "12:00 PM", location: "Faculty Room 3", deliveryMode: "Online", status: "Scheduled" }
  ],
  classCoverRequests: [
    { id: "cover-1", courseCode: "MTH301", classDateUtc: "2026-04-07T09:00:00Z", reason: "Conference presentation at the university research colloquium.", requestedCoverTeacher: "Dr. Neha Kapoor", status: "Pending", adminNote: "", requestedAtUtc: "2026-04-04T09:00:00Z" },
    { id: "cover-2", courseCode: "PHY201", classDateUtc: "2026-04-02T09:00:00Z", reason: "Medical appointment overlap.", requestedCoverTeacher: "Dr. Raj Malhotra", status: "Approved", adminNote: "Class cover confirmed with the department office.", requestedAtUtc: "2026-03-31T09:00:00Z", reviewedAtUtc: "2026-04-01T11:00:00Z" }
  ],
  coursePlans: [
    { id: "plan-1", courseCode: "CSE401", title: "Unit 3 distributed storage plan", coverage: "Replication patterns, leader election, and operational trade-offs.", status: "Submitted", reviewNote: "Waiting for department review.", updatedAtUtc: "2026-04-03T10:00:00Z", submittedAtUtc: "2026-04-03T10:00:00Z" },
    { id: "plan-2", courseCode: "PHY201", title: "Lab cycle moderation plan", coverage: "Attendance recovery support, practical demonstration flow, and quiz alignment.", status: "Approved", reviewNote: "Approved for this cycle.", updatedAtUtc: "2026-04-02T10:00:00Z", submittedAtUtc: "2026-04-01T10:00:00Z", approvedAtUtc: "2026-04-02T11:00:00Z" }
  ],
  timetableChanges: [
    { id: "time-1", courseCode: "CSE401", currentSlot: "Monday 02:00 PM | B-204", proposedSlot: "Friday 09:00 AM | B-204", reason: "Department review meeting overlaps with the current slot.", status: "Pending", reviewNote: "", requestedAtUtc: "2026-04-04T10:00:00Z" },
    { id: "time-2", courseCode: "PHY201", currentSlot: "Tuesday 10:00 AM | Lab-2", proposedSlot: "Wednesday 12:30 PM | Lab-2", reason: "Lab maintenance window for the current slot.", status: "Approved", reviewNote: "Shift approved after lab coordination.", requestedAtUtc: "2026-04-01T10:00:00Z", reviewedAtUtc: "2026-04-02T09:00:00Z" }
  ],
  mentoringRoster: [
    { id: "mentor-1", studentName: "Aarav Sharma", batch: "2022", supportArea: "Attendance recovery", riskLevel: "High", status: "Meeting Scheduled", nextMeetingAtUtc: "2026-04-06T09:00:00Z", lastContactAtUtc: "2026-04-03T09:00:00Z" },
    { id: "mentor-2", studentName: "Riya Menon", batch: "2023", supportArea: "Exam confidence and planning", riskLevel: "Medium", status: "Support Plan Active", nextMeetingAtUtc: "2026-04-08T09:00:00Z", lastContactAtUtc: "2026-04-04T09:00:00Z" }
  ],
  examBoardItems: [
    { id: "board-1", courseCode: "CSE401", assessmentName: "Midterm Internal Board Packet", boardName: "Mid Semester Review Board", panelLead: "Dr. Priya Menon", status: "Board Review", boardNote: "Waiting for final moderation sign-off.", dueAtUtc: "2026-04-07T09:00:00Z", updatedAtUtc: "2026-04-05T09:00:00Z" },
    { id: "board-2", courseCode: "PHY201", assessmentName: "Internal Quiz 2 Release Pack", boardName: "Assessment Release Board", panelLead: "Dr. Rohan Iyer", status: "Ready To Release", boardNote: "Board checks complete. Ready for final release.", dueAtUtc: "2026-04-06T09:00:00Z", updatedAtUtc: "2026-04-05T12:00:00Z" }
  ],
  notifications: [
    {
      id: "teacher-note-1",
      title: "Faculty meeting on curriculum modernization",
      message: "Department heads and professors are requested to join the review session.",
      createdAtUtc: "2026-04-04T16:00:00Z"
    },
    {
      id: "teacher-note-2",
      title: "Attendance recovery follow-up",
      message: "Physics attendance dipped below threshold in one section.",
      createdAtUtc: "2026-04-03T10:15:00Z"
    }
  ]
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function getAdministrationCounts(classCoverRequests: ClassCoverRequestItem[], coursePlans: CoursePlanItem[], officeHours: OfficeHourItem[], advisingNotes: AdvisingNoteItem[]) {
  return {
    officeHoursScheduled: officeHours.filter((item) => item.status !== "Cancelled").length,
    pendingClassCoverRequests: classCoverRequests.filter((item) => item.status === "Pending").length,
    coursePlansAwaitingApproval: coursePlans.filter((item) => item.status === "Submitted" || item.status === "Review").length,
    approvedCoursePlans: coursePlans.filter((item) => item.status === "Approved").length,
    adviseeFollowUpsOpen: advisingNotes.filter((item) => item.followUpStatus === "Open").length
  };
}

function getExtendedAdministrationCounts(
  classCoverRequests: ClassCoverRequestItem[],
  coursePlans: CoursePlanItem[],
  officeHours: OfficeHourItem[],
  advisingNotes: AdvisingNoteItem[],
  timetableChanges: TimetableChangeItem[],
  mentoringRoster: MentoringAssignmentItem[]
) {
  const base = getAdministrationCounts(classCoverRequests, coursePlans, officeHours, advisingNotes);
  return {
    ...base,
    pendingTimetableChanges: timetableChanges.filter((item) => item.status === "Pending").length,
    mentoringStudents: mentoringRoster.length,
    mentoringAlerts: mentoringRoster.filter((item) => item.riskLevel === "High" || item.status === "Needs Attention").length
  };
}

export default function TeacherPage() {
  const [state, setState] = useState<TeacherState>(demoState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const demoMode = isDemoModeEnabled();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await getAdminSession();

        if (demoMode) {
          if (!cancelled) {
            setState(demoState);
            setError(null);
            setLoading(false);
          }
          return;
        }

        const headers = {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        };

        const [teacherSummaryResponse, attendanceResponse, coursesResponse, notificationsResponse, gradingResponse, advisingResponse, sessionsResponse, draftsResponse, publishingResponse, officeHoursResponse, classCoverResponse, coursePlansResponse, timetableResponse, mentoringResponse, examBoardResponse] = await Promise.all([
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.attendance()}/api/v1/teachers/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/courses?facultyId=${session.user.id}&pageSize=10`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}&pageSize=5`, { headers }),
          fetch(`${apiConfig.exam()}/api/v1/teachers/${session.user.id}/grading-summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/advising-notes`, { headers }),
          fetch(`${apiConfig.attendance()}/api/v1/teachers/${session.user.id}/sessions?pageSize=6`, { headers }),
          fetch(`${apiConfig.lms()}/api/v1/teachers/${session.user.id}/content-drafts`, { headers }),
          fetch(`${apiConfig.exam()}/api/v1/teachers/${session.user.id}/publishing-queue`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/office-hours`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/substitution-requests`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/course-plans`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/timetable-change-requests`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/mentoring-roster`, { headers }),
          fetch(`${apiConfig.exam()}/api/v1/teachers/${session.user.id}/exam-board`, { headers })
        ]);

        if (!teacherSummaryResponse.ok || !attendanceResponse.ok || !coursesResponse.ok || !notificationsResponse.ok || !gradingResponse.ok || !advisingResponse.ok || !sessionsResponse.ok || !draftsResponse.ok || !publishingResponse.ok || !officeHoursResponse.ok || !classCoverResponse.ok || !coursePlansResponse.ok || !timetableResponse.ok || !mentoringResponse.ok || !examBoardResponse.ok) {
          throw new Error("Unable to load the teacher page.");
        }

        const [teacherSummaryPayload, attendancePayload, coursesPayload, notificationsPayload, gradingPayload, advisingPayload, sessionsPayload, draftsPayload, publishingPayload, officeHoursPayload, classCoverPayload, coursePlansPayload, timetablePayload, mentoringPayload, examBoardPayload] = await Promise.all([
          teacherSummaryResponse.json(),
          attendanceResponse.json(),
          coursesResponse.json(),
          notificationsResponse.json(),
          gradingResponse.json(),
          advisingResponse.json(),
          sessionsResponse.json(),
          draftsResponse.json(),
          publishingResponse.json(),
          officeHoursResponse.json(),
          classCoverResponse.json(),
          coursePlansResponse.json(),
          timetableResponse.json(),
          mentoringResponse.json(),
          examBoardResponse.json()
        ]);

        const ownedCourses = (coursesPayload?.items ?? []) as CourseItem[];
        const courseCodes = Array.from(new Set(ownedCourses.map((item) => item.courseCode)));
        const lmsSummaryResponse = await fetch(
          `${apiConfig.lms()}/api/v1/workspace/summary${courseCodes.length > 0 ? `?courseCodes=${encodeURIComponent(courseCodes.join(","))}` : ""}`,
          { headers }
        );
        const lmsSummaryPayload = lmsSummaryResponse.ok ? await lmsSummaryResponse.json() : { materials: 0, assignments: 0 };

        if (!cancelled) {
          setState({
            attendancePercentage: attendancePayload?.attendancePercentage ?? 0,
            totalCourses: teacherSummaryPayload?.totalCourses ?? 0,
            nextCourse: teacherSummaryPayload?.nextCourse?.title ?? "No class scheduled",
            teachingLoad: teacherSummaryPayload?.teachingLoad ?? 0,
            officeHoursScheduled: teacherSummaryPayload?.officeHoursScheduled ?? 0,
            pendingClassCoverRequests: teacherSummaryPayload?.pendingClassCoverRequests ?? 0,
            coursePlansAwaitingApproval: teacherSummaryPayload?.coursePlansAwaitingApproval ?? 0,
            approvedCoursePlans: teacherSummaryPayload?.approvedCoursePlans ?? 0,
            adviseeFollowUpsOpen: teacherSummaryPayload?.adviseeFollowUpsOpen ?? 0,
            pendingTimetableChanges: teacherSummaryPayload?.pendingTimetableChanges ?? 0,
            mentoringStudents: teacherSummaryPayload?.mentoringStudents ?? 0,
            mentoringAlerts: teacherSummaryPayload?.mentoringAlerts ?? 0,
            activeSessions: attendancePayload?.activeSessions ?? 0,
            lowAttendanceCourses: attendancePayload?.lowAttendanceCourses ?? 0,
            lmsMaterials: lmsSummaryPayload?.materials ?? 0,
            lmsAssignments: lmsSummaryPayload?.assignments ?? 0,
            gradingPending: gradingPayload?.pending ?? 0,
            gradingReady: gradingPayload?.readyToPublish ?? 0,
            ownedCourses,
            alerts: (attendancePayload?.alerts ?? []) as AttendanceAlert[],
            sessions: (sessionsPayload?.items ?? []) as AttendanceSessionItem[],
            gradeReviews: (gradingPayload?.items ?? []) as GradeReviewItem[],
            contentDrafts: (draftsPayload?.items ?? []) as ContentDraftItem[],
            publishingQueue: (publishingPayload?.items ?? []) as AssessmentPublicationItem[],
            advisingNotes: (advisingPayload?.items ?? []) as AdvisingNoteItem[],
            officeHours: (officeHoursPayload?.items ?? []) as OfficeHourItem[],
            classCoverRequests: (classCoverPayload?.items ?? []) as ClassCoverRequestItem[],
            coursePlans: (coursePlansPayload?.items ?? []) as CoursePlanItem[],
            timetableChanges: (timetablePayload?.items ?? []) as TimetableChangeItem[],
            mentoringRoster: (mentoringPayload?.items ?? []) as MentoringAssignmentItem[],
            examBoardItems: (examBoardPayload?.items ?? []) as ExamBoardItem[],
            notifications: notificationsPayload?.items ?? []
          });
          setError(null);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          if (loadError instanceof Error && loadError.message.includes("No admin session")) {
            window.location.href = "/auth?role=Teacher&redirect=%2Fteacher";
            return;
          }
          setError(loadError instanceof Error ? loadError.message : "Unexpected teacher workspace error.");
          setLoading(false);
        }
      }
    }

    load();
    const intervalId = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [demoMode]);

  async function handleSignOut() {
    setSigningOut(true);
    await logoutAdmin().catch(() => null);
    window.location.href = "/auth";
  }

  async function updateGradeReview(item: GradeReviewItem, status: string) {
    setBusyId(item.id);

    try {
      if (demoMode) {
        setState((current) => ({
          ...current,
          gradeReviews: current.gradeReviews.map((review) => (review.id === item.id ? { ...review, status } : review)),
          gradingPending: current.gradeReviews.filter((review) => review.id === item.id ? status === "Pending Review" : review.status === "Pending Review").length,
          gradingReady: current.gradeReviews.filter((review) => review.id === item.id ? status === "Ready To Publish" : review.status === "Ready To Publish").length
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.exam()}/api/v1/teachers/${session.user.id}/grade-reviews/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          reviewerNote: status === "Ready To Publish" ? "Faculty review completed from the teacher workspace." : item.reviewerNote
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update grading review.");
      }

      const payload = (await response.json()) as GradeReviewItem;
      setState((current) => {
        const nextReviews = current.gradeReviews.map((review) => (review.id === item.id ? { ...review, ...payload } : review));
        return {
          ...current,
          gradeReviews: nextReviews,
          gradingPending: nextReviews.filter((review) => review.status === "Pending Review").length,
          gradingReady: nextReviews.filter((review) => review.status === "Ready To Publish").length
        };
      });
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update grading review.");
    } finally {
      setBusyId(null);
    }
  }

  async function startAttendanceSession(course: CourseItem) {
    setBusyId(`start-${course.id}`);

    try {
      if (demoMode) {
        const nextSession: AttendanceSessionItem = {
          id: `demo-session-${Date.now()}`,
          courseCode: course.courseCode,
          qrCode: `QR-${course.courseCode}-${Date.now().toString().slice(-4)}`,
          status: "Active",
          startedAtUtc: new Date().toISOString()
        };
        setState((current) => ({
          ...current,
          activeSessions: current.activeSessions + 1,
          sessions: [nextSession, ...current.sessions.filter((item) => !(item.courseCode === course.courseCode && item.status === "Active"))].slice(0, 6)
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.attendance()}/api/v1/teachers/${session.user.id}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          courseCode: course.courseCode
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to start attendance session.");
      }

      const payload = (await response.json()) as AttendanceSessionItem;
      setState((current) => {
        const nextSessions = [payload, ...current.sessions.filter((item) => item.id !== payload.id)].slice(0, 6);
        return {
          ...current,
          activeSessions: nextSessions.filter((item) => item.status === "Active").length,
          sessions: nextSessions
        };
      });
      setError(null);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Unable to start attendance session.");
    } finally {
      setBusyId(null);
    }
  }

  async function closeAttendanceSession(item: AttendanceSessionItem) {
    setBusyId(item.id);

    try {
      if (demoMode) {
        setState((current) => {
          const nextSessions = current.sessions.map((session) =>
            session.id === item.id ? { ...session, status: "Closed", closedAtUtc: new Date().toISOString() } : session
          );
          return {
            ...current,
            activeSessions: nextSessions.filter((session) => session.status === "Active").length,
            sessions: nextSessions
          };
        });
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.attendance()}/api/v1/teachers/${session.user.id}/sessions/${item.id}/close`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        }
      });

      if (!response.ok) {
        throw new Error("Unable to close attendance session.");
      }

      const payload = (await response.json()) as AttendanceSessionItem;
      setState((current) => {
        const nextSessions = current.sessions.map((session) => (session.id === item.id ? { ...session, ...payload } : session));
        return {
          ...current,
          activeSessions: nextSessions.filter((session) => session.status === "Active").length,
          sessions: nextSessions
        };
      });
      setError(null);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Unable to close attendance session.");
    } finally {
      setBusyId(null);
    }
  }

  async function quickCaptureAttendance(item: AttendanceSessionItem) {
    setBusyId(`capture-${item.id}`);

    try {
      if (demoMode) {
        setState((current) => ({
          ...current,
          alerts: current.alerts.map((alert) =>
            alert.courseCode === item.courseCode
              ? { ...alert, totalRecords: alert.totalRecords + 1, percentage: Math.min(100, Number((alert.percentage + 8).toFixed(2))) }
              : alert
          )
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.attendance()}/api/v1/teachers/${session.user.id}/sessions/${item.id}/quick-record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          studentId: "00000000-0000-0000-0000-000000000123",
          status: "Present",
          method: "Manual"
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to capture attendance.");
      }

      setState((current) => ({
        ...current,
        alerts: current.alerts.map((alert) =>
          alert.courseCode === item.courseCode
            ? { ...alert, totalRecords: alert.totalRecords + 1, percentage: Math.min(100, Number((alert.percentage + 8).toFixed(2))) }
            : alert
        )
      }));
      setError(null);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Unable to capture attendance.");
    } finally {
      setBusyId(null);
    }
  }

  async function createContentDraft(courseCode: string, draftType: string, title: string) {
    setBusyId(`${draftType}-${courseCode}`);

    try {
      if (demoMode) {
        const item: ContentDraftItem = {
          id: `draft-${Date.now()}`,
          courseCode,
          draftType,
          title,
          status: "Draft",
          updatedAtUtc: new Date().toISOString()
        };
        setState((current) => ({ ...current, contentDrafts: [item, ...current.contentDrafts].slice(0, 5) }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.lms()}/api/v1/teachers/${session.user.id}/content-drafts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          courseCode,
          draftType,
          title
        })
      });

      if (!response.ok) {
        throw new Error("Unable to create content draft.");
      }

      const payload = (await response.json()) as ContentDraftItem;
      setState((current) => ({ ...current, contentDrafts: [payload, ...current.contentDrafts].slice(0, 5) }));
      setError(null);
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Unable to create content draft.");
    } finally {
      setBusyId(null);
    }
  }

  async function updatePublishingQueue(item: AssessmentPublicationItem, status: string) {
    setBusyId(`publish-${item.id}`);

    try {
      if (demoMode) {
        setState((current) => ({
          ...current,
          publishingQueue: current.publishingQueue.map((entry) =>
            entry.id === item.id ? { ...entry, status, updatedAtUtc: new Date().toISOString() } : entry
          )
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.exam()}/api/v1/teachers/${session.user.id}/publishing-queue/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          moderationNote: status === "Published" ? "Published from the teacher workspace." : "Moved through the publication queue from teacher workspace."
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update publishing queue.");
      }

      const payload = (await response.json()) as AssessmentPublicationItem;
      setState((current) => ({
        ...current,
        publishingQueue: current.publishingQueue.map((entry) => (entry.id === item.id ? { ...entry, ...payload } : entry))
      }));
      setError(null);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to update publishing queue.");
    } finally {
      setBusyId(null);
    }
  }

  async function addAdvisingNote(courseCode: string, title: string, note: string) {
    setBusyId(title);

    try {
      if (demoMode) {
        const nextNote: AdvisingNoteItem = {
          id: `demo-note-${Date.now()}`,
          studentName: "Aarav Sharma",
          courseCode,
          title,
          note,
          followUpStatus: "Open",
          createdAtUtc: new Date().toISOString()
        };
        setState((current) => ({
          ...current,
          advisingNotes: [nextNote, ...current.advisingNotes].slice(0, 4),
          adviseeFollowUpsOpen: current.advisingNotes.filter((item) => item.followUpStatus === "Open").length + 1
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/advising-notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          studentName: "Aarav Sharma",
          courseCode,
          title,
          note,
          followUpStatus: "Open"
        })
      });

      if (!response.ok) {
        throw new Error("Unable to add advising note.");
      }

      const payload = (await response.json()) as AdvisingNoteItem;
      setState((current) => ({
        ...current,
        advisingNotes: [payload, ...current.advisingNotes].slice(0, 4),
        adviseeFollowUpsOpen: [...current.advisingNotes, payload].filter((item) => item.followUpStatus === "Open").length
      }));
      setError(null);
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Unable to add advising note.");
    } finally {
      setBusyId(null);
    }
  }

  async function createOfficeHour(courseCode: string, dayOfWeek: string, startTime: string, endTime: string, location: string, deliveryMode: string) {
    setBusyId(`office-${courseCode}`);

    try {
      if (demoMode) {
        const nextOfficeHour: OfficeHourItem = {
          id: `office-${Date.now()}`,
          courseCode,
          dayOfWeek,
          startTime,
          endTime,
          location,
          deliveryMode,
          status: "Scheduled"
        };
        setState((current) => ({
          ...current,
          officeHours: [nextOfficeHour, ...current.officeHours].slice(0, 4),
          officeHoursScheduled: current.officeHours.filter((item) => item.status !== "Cancelled").length + 1
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/office-hours`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          courseCode,
          dayOfWeek,
          startTime,
          endTime,
          location,
          deliveryMode,
          status: "Scheduled"
        })
      });

      if (!response.ok) {
        throw new Error("Unable to save office hour.");
      }

      const payload = (await response.json()) as OfficeHourItem;
      setState((current) => ({
        ...current,
        officeHours: [payload, ...current.officeHours].slice(0, 4),
        officeHoursScheduled: [...current.officeHours, payload].filter((item) => item.status !== "Cancelled").length
      }));
      setError(null);
    } catch (officeHourError) {
      setError(officeHourError instanceof Error ? officeHourError.message : "Unable to save office hour.");
    } finally {
      setBusyId(null);
    }
  }

  async function createClassCoverRequest(courseCode: string, reason: string, requestedCoverTeacher: string) {
    setBusyId(`cover-${courseCode}`);

    try {
      if (demoMode) {
        const nextRequest: ClassCoverRequestItem = {
          id: `cover-${Date.now()}`,
          courseCode,
          classDateUtc: new Date(Date.now() + 86400000).toISOString(),
          reason,
          requestedCoverTeacher,
          status: "Pending",
          adminNote: "",
          requestedAtUtc: new Date().toISOString()
        };
        setState((current) => ({
          ...current,
          classCoverRequests: [nextRequest, ...current.classCoverRequests].slice(0, 4),
          pendingClassCoverRequests: current.classCoverRequests.filter((item) => item.status === "Pending").length + 1
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/substitution-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          courseCode,
          classDateUtc: new Date(Date.now() + 86400000).toISOString(),
          reason,
          requestedCoverTeacher,
          status: "Pending"
        })
      });

      if (!response.ok) {
        throw new Error("Unable to request class cover.");
      }

      const payload = (await response.json()) as ClassCoverRequestItem;
      setState((current) => ({
        ...current,
        classCoverRequests: [payload, ...current.classCoverRequests].slice(0, 4),
        pendingClassCoverRequests: [...current.classCoverRequests, payload].filter((item) => item.status === "Pending").length
      }));
      setError(null);
    } catch (coverError) {
      setError(coverError instanceof Error ? coverError.message : "Unable to request class cover.");
    } finally {
      setBusyId(null);
    }
  }

  async function updateClassCoverRequest(item: ClassCoverRequestItem, status: string, adminNote: string) {
    setBusyId(`cover-status-${item.id}`);

    try {
      if (demoMode) {
        const nextRequests = state.classCoverRequests.map((entry) =>
          entry.id === item.id ? { ...entry, status, adminNote, reviewedAtUtc: new Date().toISOString() } : entry
        );
        setState((current) => ({
          ...current,
          classCoverRequests: nextRequests,
          pendingClassCoverRequests: nextRequests.filter((entry) => entry.status === "Pending").length
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/substitution-requests/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          adminNote,
          requestedCoverTeacher: item.requestedCoverTeacher
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update class cover request.");
      }

      const payload = (await response.json()) as ClassCoverRequestItem;
      setState((current) => {
        const nextRequests = current.classCoverRequests.map((entry) => (entry.id === item.id ? { ...entry, ...payload } : entry));
        return {
          ...current,
          classCoverRequests: nextRequests,
          pendingClassCoverRequests: nextRequests.filter((entry) => entry.status === "Pending").length
        };
      });
      setError(null);
    } catch (coverError) {
      setError(coverError instanceof Error ? coverError.message : "Unable to update class cover request.");
    } finally {
      setBusyId(null);
    }
  }

  async function createCoursePlan(courseCode: string, title: string, coverage: string, status: string) {
    setBusyId(`plan-${courseCode}`);

    try {
      if (demoMode) {
        const now = new Date().toISOString();
        const nextPlan: CoursePlanItem = {
          id: `plan-${Date.now()}`,
          courseCode,
          title,
          coverage,
          status,
          reviewNote: status === "Submitted" ? "Waiting for department review." : "Saved as a working draft.",
          updatedAtUtc: now,
          submittedAtUtc: status === "Submitted" ? now : null
        };
        const nextPlans = [nextPlan, ...state.coursePlans].slice(0, 4);
        const counts = getAdministrationCounts(state.classCoverRequests, nextPlans, state.officeHours, state.advisingNotes);
        setState((current) => ({
          ...current,
          coursePlans: nextPlans,
          coursePlansAwaitingApproval: counts.coursePlansAwaitingApproval,
          approvedCoursePlans: counts.approvedCoursePlans
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/course-plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          courseCode,
          title,
          coverage,
          status,
          reviewNote: status === "Submitted" ? "Waiting for department review." : "Saved as a working draft."
        })
      });

      if (!response.ok) {
        throw new Error("Unable to save course plan.");
      }

      const payload = (await response.json()) as CoursePlanItem;
      setState((current) => {
        const nextPlans = [payload, ...current.coursePlans].slice(0, 4);
        const counts = getAdministrationCounts(current.classCoverRequests, nextPlans, current.officeHours, current.advisingNotes);
        return {
          ...current,
          coursePlans: nextPlans,
          coursePlansAwaitingApproval: counts.coursePlansAwaitingApproval,
          approvedCoursePlans: counts.approvedCoursePlans
        };
      });
      setError(null);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Unable to save course plan.");
    } finally {
      setBusyId(null);
    }
  }

  async function updateCoursePlan(item: CoursePlanItem, status: string, reviewNote: string) {
    setBusyId(`plan-status-${item.id}`);

    try {
      if (demoMode) {
        const now = new Date().toISOString();
        const nextPlans = state.coursePlans.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status,
                reviewNote,
                updatedAtUtc: now,
                submittedAtUtc: status === "Submitted" ? entry.submittedAtUtc ?? now : entry.submittedAtUtc,
                approvedAtUtc: status === "Approved" ? now : entry.approvedAtUtc
              }
            : entry
        );
        const counts = getAdministrationCounts(state.classCoverRequests, nextPlans, state.officeHours, state.advisingNotes);
        setState((current) => ({
          ...current,
          coursePlans: nextPlans,
          coursePlansAwaitingApproval: counts.coursePlansAwaitingApproval,
          approvedCoursePlans: counts.approvedCoursePlans
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/course-plans/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          reviewNote
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update course plan.");
      }

      const payload = (await response.json()) as CoursePlanItem;
      setState((current) => {
        const nextPlans = current.coursePlans.map((entry) => (entry.id === item.id ? { ...entry, ...payload } : entry));
        const counts = getAdministrationCounts(current.classCoverRequests, nextPlans, current.officeHours, current.advisingNotes);
        return {
          ...current,
          coursePlans: nextPlans,
          coursePlansAwaitingApproval: counts.coursePlansAwaitingApproval,
          approvedCoursePlans: counts.approvedCoursePlans
        };
      });
      setError(null);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Unable to update course plan.");
    } finally {
      setBusyId(null);
    }
  }

  async function createTimetableChange(courseCode: string, currentSlot: string, proposedSlot: string, reason: string) {
    setBusyId(`timetable-${courseCode}`);

    try {
      if (demoMode) {
        const nextItem: TimetableChangeItem = {
          id: `timetable-${Date.now()}`,
          courseCode,
          currentSlot,
          proposedSlot,
          reason,
          status: "Pending",
          reviewNote: "",
          requestedAtUtc: new Date().toISOString()
        };
        const nextChanges = [nextItem, ...state.timetableChanges].slice(0, 4);
        const counts = getExtendedAdministrationCounts(state.classCoverRequests, state.coursePlans, state.officeHours, state.advisingNotes, nextChanges, state.mentoringRoster);
        setState((current) => ({
          ...current,
          timetableChanges: nextChanges,
          pendingTimetableChanges: counts.pendingTimetableChanges
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/timetable-change-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          courseCode,
          currentSlot,
          proposedSlot,
          reason,
          status: "Pending"
        })
      });

      if (!response.ok) {
        throw new Error("Unable to save timetable request.");
      }

      const payload = (await response.json()) as TimetableChangeItem;
      setState((current) => {
        const nextChanges = [payload, ...current.timetableChanges].slice(0, 4);
        const counts = getExtendedAdministrationCounts(current.classCoverRequests, current.coursePlans, current.officeHours, current.advisingNotes, nextChanges, current.mentoringRoster);
        return {
          ...current,
          timetableChanges: nextChanges,
          pendingTimetableChanges: counts.pendingTimetableChanges
        };
      });
      setError(null);
    } catch (timetableError) {
      setError(timetableError instanceof Error ? timetableError.message : "Unable to save timetable request.");
    } finally {
      setBusyId(null);
    }
  }

  async function updateTimetableChange(item: TimetableChangeItem, status: string, reviewNote: string) {
    setBusyId(`timetable-status-${item.id}`);

    try {
      if (demoMode) {
        const nextChanges = state.timetableChanges.map((entry) =>
          entry.id === item.id ? { ...entry, status, reviewNote, reviewedAtUtc: new Date().toISOString() } : entry
        );
        const counts = getExtendedAdministrationCounts(state.classCoverRequests, state.coursePlans, state.officeHours, state.advisingNotes, nextChanges, state.mentoringRoster);
        setState((current) => ({
          ...current,
          timetableChanges: nextChanges,
          pendingTimetableChanges: counts.pendingTimetableChanges
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/timetable-change-requests/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          reviewNote
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update timetable request.");
      }

      const payload = (await response.json()) as TimetableChangeItem;
      setState((current) => {
        const nextChanges = current.timetableChanges.map((entry) => (entry.id === item.id ? { ...entry, ...payload } : entry));
        const counts = getExtendedAdministrationCounts(current.classCoverRequests, current.coursePlans, current.officeHours, current.advisingNotes, nextChanges, current.mentoringRoster);
        return {
          ...current,
          timetableChanges: nextChanges,
          pendingTimetableChanges: counts.pendingTimetableChanges
        };
      });
      setError(null);
    } catch (timetableError) {
      setError(timetableError instanceof Error ? timetableError.message : "Unable to update timetable request.");
    } finally {
      setBusyId(null);
    }
  }

  async function updateMentoringAssignment(item: MentoringAssignmentItem, status: string, supportArea: string) {
    setBusyId(`mentoring-${item.id}`);

    try {
      if (demoMode) {
        const nextRoster = state.mentoringRoster.map((entry) =>
          entry.id === item.id ? { ...entry, status, supportArea, lastContactAtUtc: new Date().toISOString() } : entry
        );
        const counts = getExtendedAdministrationCounts(state.classCoverRequests, state.coursePlans, state.officeHours, state.advisingNotes, state.timetableChanges, nextRoster);
        setState((current) => ({
          ...current,
          mentoringRoster: nextRoster,
          mentoringStudents: counts.mentoringStudents,
          mentoringAlerts: counts.mentoringAlerts
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/mentoring-roster/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          supportArea,
          nextMeetingAtUtc: new Date(Date.now() + 3 * 86400000).toISOString()
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update mentoring record.");
      }

      const payload = (await response.json()) as MentoringAssignmentItem;
      setState((current) => {
        const nextRoster = current.mentoringRoster.map((entry) => (entry.id === item.id ? { ...entry, ...payload } : entry));
        const counts = getExtendedAdministrationCounts(current.classCoverRequests, current.coursePlans, current.officeHours, current.advisingNotes, current.timetableChanges, nextRoster);
        return {
          ...current,
          mentoringRoster: nextRoster,
          mentoringStudents: counts.mentoringStudents,
          mentoringAlerts: counts.mentoringAlerts
        };
      });
      setError(null);
    } catch (mentoringError) {
      setError(mentoringError instanceof Error ? mentoringError.message : "Unable to update mentoring record.");
    } finally {
      setBusyId(null);
    }
  }

  async function updateExamBoardItem(item: ExamBoardItem, status: string, boardNote: string) {
    setBusyId(`board-${item.id}`);

    try {
      if (demoMode) {
        setState((current) => ({
          ...current,
          examBoardItems: current.examBoardItems.map((entry) =>
            entry.id === item.id ? { ...entry, status, boardNote, updatedAtUtc: new Date().toISOString() } : entry
          )
        }));
        return;
      }

      const session = await getAdminSession();
      const response = await fetch(`${apiConfig.exam()}/api/v1/teachers/${session.user.id}/exam-board/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          boardNote,
          panelLead: item.panelLead
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update exam board item.");
      }

      const payload = (await response.json()) as ExamBoardItem;
      setState((current) => ({
        ...current,
        examBoardItems: current.examBoardItems.map((entry) => (entry.id === item.id ? { ...entry, ...payload } : entry))
      }));
      setError(null);
    } catch (examBoardError) {
      setError(examBoardError instanceof Error ? examBoardError.message : "Unable to update exam board item.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="panel-grid min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(31,16,5,0.95),rgba(78,44,13,0.82)_58%,rgba(24,13,5,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-amber-200">Teacher workspace</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Faculty grading, advising, attendance risk, and course delivery in one place.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                The teacher experience now includes real grading and advising actions, not just observational summaries.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/portal" className="rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-100">
                Open Portal
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                {signingOut ? "Signing Out..." : "Sign Out"}
              </button>
            </div>
          </div>
        </section>

        {error ? <div className="mt-6 rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-50">{error}</div> : null}

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Owned courses</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.totalCourses}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">Teacher-specific course ownership from the academic service.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Attendance health</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : `${state.attendancePercentage}%`}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">Professor-scoped session performance, not only tenant averages.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Pending grading</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.gradingPending}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">Assessments that still need faculty review before release.</p>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Ready to publish</p>
            <p className="mt-4 text-3xl font-semibold text-white">{loading ? "..." : state.gradingReady}</p>
            <p className="mt-3 text-sm leading-6 text-amber-100/90">Grade reviews that can move cleanly into publishing.</p>
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Course ownership</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Faculty schedule and next-class context</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {loading ? "Loading" : state.nextCourse}
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {state.ownedCourses.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.courseCode}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.semesterCode}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{item.dayOfWeek} | {item.startTime} | {item.room}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Teaching operations</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">LMS workload and attendance control live beside grading now</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Teaching load</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.teachingLoad}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Materials</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.lmsMaterials}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Assignments</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.lmsAssignments}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {state.ownedCourses.slice(0, 2).map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => startAttendanceSession(course)}
                  disabled={busyId === `start-${course.id}` || state.sessions.some((item) => item.courseCode === course.courseCode && item.status === "Active")}
                  className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                >
                  {busyId === `start-${course.id}` ? "Starting..." : `Start ${course.courseCode}`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => createContentDraft("CSE401", "Module Outline", "New distributed systems module outline")}
                disabled={busyId === "Module Outline-CSE401"}
                className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
              >
                {busyId === "Module Outline-CSE401" ? "Saving..." : "Create Module Draft"}
              </button>
              <button
                type="button"
                onClick={() => createContentDraft("PHY201", "Assessment Brief", "New physics assessment brief")}
                disabled={busyId === "Assessment Brief-PHY201"}
                className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-fuchsia-100 disabled:opacity-50"
              >
                {busyId === "Assessment Brief-PHY201" ? "Saving..." : "Create Assessment Draft"}
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {state.alerts.map((item) => (
                <article key={`${item.courseCode}-${item.totalRecords}`} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.courseCode}</p>
                    <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-amber-100">{item.percentage.toFixed(2)}%</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.totalRecords} captured records in the current teaching history.</p>
                </article>
              ))}
            </div>
            <div className="mt-5 space-y-4">
              {state.sessions.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.courseCode}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.qrCode}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">Started {formatTimestamp(item.startedAtUtc)}</p>
                  {item.closedAtUtc ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-200">Closed {formatTimestamp(item.closedAtUtc)}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => quickCaptureAttendance(item)}
                      disabled={busyId === `capture-${item.id}` || item.status !== "Active"}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                    >
                      {busyId === `capture-${item.id}` ? "Capturing..." : "Capture Check-In"}
                    </button>
                    <button
                      type="button"
                      onClick={() => closeAttendanceSession(item)}
                      disabled={busyId === item.id || item.status === "Closed"}
                      className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-amber-100 disabled:opacity-50"
                    >
                      {busyId === item.id ? "Updating..." : "Close Session"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-5 space-y-4">
              {state.contentDrafts.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.courseCode} | {item.draftType}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-emerald-200">Updated {formatTimestamp(item.updatedAtUtc)}</p>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Teaching admin</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Office hours, class cover, and student follow-up</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Office hours</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.officeHoursScheduled}</p>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Open student follow-ups</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.adviseeFollowUpsOpen}</p>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Mentoring roster</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.mentoringStudents}</p>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Mentoring alerts</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.mentoringAlerts}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => createOfficeHour("CSE401", "Friday", "01:30 PM", "02:15 PM", "B-204", "In Person")}
                disabled={busyId === "office-CSE401"}
                className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
              >
                {busyId === "office-CSE401" ? "Saving..." : "Add CSE401 Office Hour"}
              </button>
              <button
                type="button"
                onClick={() => createOfficeHour("PHY201", "Friday", "11:30 AM", "12:15 PM", "Faculty Room 3", "Online")}
                disabled={busyId === "office-PHY201"}
                className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
              >
                {busyId === "office-PHY201" ? "Saving..." : "Add Physics Office Hour"}
              </button>
              <button
                type="button"
                onClick={() => createTimetableChange("CSE401", "Monday 02:00 PM | B-204", "Friday 09:00 AM | B-204", "Department review meeting overlaps with the current slot.")}
                disabled={busyId === "timetable-CSE401"}
                className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-fuchsia-100 disabled:opacity-50"
              >
                {busyId === "timetable-CSE401" ? "Saving..." : "Request Timetable Shift"}
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {state.officeHours.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.courseCode}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.dayOfWeek} | {item.startTime} - {item.endTime}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.location} | {item.deliveryMode}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 space-y-4">
              {state.mentoringRoster.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.studentName}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.riskLevel}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.batch} | {item.status}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.supportArea}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">Next meeting {formatTimestamp(item.nextMeetingAtUtc)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateMentoringAssignment(item, "Support Plan Active", item.supportArea)}
                      disabled={busyId === `mentoring-${item.id}` || item.status === "Support Plan Active"}
                      className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                    >
                      {busyId === `mentoring-${item.id}` ? "Updating..." : "Start Support Plan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMentoringAssignment(item, "Meeting Scheduled", `${item.supportArea} | Follow-up booked`)}
                      disabled={busyId === `mentoring-${item.id}` || item.status === "Meeting Scheduled"}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                    >
                      {busyId === `mentoring-${item.id}` ? "Updating..." : "Book Follow-Up"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Planning and coverage</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Keep class cover and course plans moving</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Pending class cover</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.pendingClassCoverRequests}</p>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Plans waiting for approval</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.coursePlansAwaitingApproval}</p>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm text-slate-400">Timetable requests</p>
                <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : state.pendingTimetableChanges}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => createClassCoverRequest("MTH301", "Conference presentation at the university research colloquium.", "Dr. Neha Kapoor")}
                disabled={busyId === "cover-MTH301"}
                className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-amber-100 disabled:opacity-50"
              >
                {busyId === "cover-MTH301" ? "Saving..." : "Request Class Cover"}
              </button>
              <button
                type="button"
                onClick={() => createCoursePlan("CSE401", "Unit 4 release plan", "Consistency models, recovery drills, and quiz checkpoints.", "Submitted")}
                disabled={busyId === "plan-CSE401"}
                className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-fuchsia-100 disabled:opacity-50"
              >
                {busyId === "plan-CSE401" ? "Saving..." : "Submit Course Plan"}
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {state.classCoverRequests.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.courseCode}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{formatTimestamp(item.classDateUtc)} | {item.requestedCoverTeacher || "Cover teacher pending"}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.reason}</p>
                  {item.adminNote ? <p className="mt-2 text-sm leading-6 text-amber-100/90">{item.adminNote}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateClassCoverRequest(item, "Approved", "Cover teacher confirmed with the department office.")}
                      disabled={busyId === `cover-status-${item.id}` || item.status === "Approved"}
                      className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                    >
                      {busyId === `cover-status-${item.id}` ? "Updating..." : "Approve Cover"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateClassCoverRequest(item, "Assigned", "Department office has assigned the backup teacher.")}
                      disabled={busyId === `cover-status-${item.id}` || item.status === "Assigned"}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                    >
                      {busyId === `cover-status-${item.id}` ? "Updating..." : "Mark Assigned"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-6 space-y-4">
              {state.timetableChanges.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.courseCode}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.currentSlot}</p>
                  <p className="mt-2 text-sm leading-6 text-cyan-100/90">{item.proposedSlot}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.reason}</p>
                  {item.reviewNote ? <p className="mt-2 text-sm leading-6 text-amber-100/90">{item.reviewNote}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateTimetableChange(item, "Approved", "Shift approved after department timetable review.")}
                      disabled={busyId === `timetable-status-${item.id}` || item.status === "Approved"}
                      className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                    >
                      {busyId === `timetable-status-${item.id}` ? "Updating..." : "Approve Shift"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTimetableChange(item, "Review", "Need room desk confirmation before approval.")}
                      disabled={busyId === `timetable-status-${item.id}` || item.status === "Review"}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-white disabled:opacity-50"
                    >
                      {busyId === `timetable-status-${item.id}` ? "Updating..." : "Hold For Review"}
                    </button>
                  </div>
                </article>
              ))}
              {state.coursePlans.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.courseCode}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.coverage}</p>
                  {item.reviewNote ? <p className="mt-2 text-sm leading-6 text-amber-100/90">{item.reviewNote}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateCoursePlan(item, "Submitted", "Waiting for department review.")}
                      disabled={busyId === `plan-status-${item.id}` || item.status === "Submitted" || item.status === "Approved"}
                      className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-fuchsia-100 disabled:opacity-50"
                    >
                      {busyId === `plan-status-${item.id}` ? "Updating..." : "Send for Review"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCoursePlan(item, "Approved", "Approved and ready for this teaching cycle.")}
                      disabled={busyId === `plan-status-${item.id}` || item.status === "Approved"}
                      className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                    >
                      {busyId === `plan-status-${item.id}` ? "Updating..." : "Mark Approved"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-rose-200">Grading queue</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Move assessments from review to publishing readiness</h2>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {state.gradeReviews.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.studentName}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.courseCode} | {item.assessmentName}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.reviewerNote}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateGradeReview(item, "Ready To Publish")}
                      disabled={busyId === item.id || item.status === "Ready To Publish" || item.status === "Published"}
                      className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                    >
                      {busyId === item.id ? "Updating..." : "Mark Ready"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateGradeReview(item, "Published")}
                      disabled={busyId === item.id || item.status === "Published"}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                    >
                      {busyId === item.id ? "Updating..." : "Publish"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-6 space-y-4">
              {state.publishingQueue.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.assessmentName}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.courseCode}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.moderationNote}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updatePublishingQueue(item, "Ready To Publish")}
                      disabled={busyId === `publish-${item.id}` || item.status === "Ready To Publish" || item.status === "Published"}
                      className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
                    >
                      {busyId === `publish-${item.id}` ? "Updating..." : "Move Ready"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePublishingQueue(item, "Published")}
                      disabled={busyId === `publish-${item.id}` || item.status === "Published"}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                    >
                      {busyId === `publish-${item.id}` ? "Updating..." : "Publish Packet"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-6 space-y-4">
              {state.examBoardItems.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.assessmentName}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.courseCode} | {item.boardName}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.boardNote}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-fuchsia-200">Panel lead {item.panelLead} | due {formatTimestamp(item.dueAtUtc)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateExamBoardItem(item, "Ready To Release", "Moderation pack accepted by the board.")}
                      disabled={busyId === `board-${item.id}` || item.status === "Ready To Release" || item.status === "Released"}
                      className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-fuchsia-100 disabled:opacity-50"
                    >
                      {busyId === `board-${item.id}` ? "Updating..." : "Ready To Release"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateExamBoardItem(item, "Released", "Released after board approval.")}
                      disabled={busyId === `board-${item.id}` || item.status === "Released"}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                    >
                      {busyId === `board-${item.id}` ? "Updating..." : "Release"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Advising notes</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Capture interventions and support actions directly from faculty view</h2>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addAdvisingNote("PHY201", "Attendance intervention", "Student should attend the next two lab sessions and check in after the quiz review.")}
                disabled={busyId === "Attendance intervention"}
                className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-amber-100 disabled:opacity-50"
              >
                {busyId === "Attendance intervention" ? "Saving..." : "Attendance Plan"}
              </button>
              <button
                type="button"
                onClick={() => addAdvisingNote("CSE401", "Exam readiness counseling", "Recommended focused practice on consistency models before the next internal review.")}
                disabled={busyId === "Exam readiness counseling"}
                className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
              >
                {busyId === "Exam readiness counseling" ? "Saving..." : "Exam Coaching"}
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {state.advisingNotes.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item.followUpStatus}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.studentName} | {item.courseCode}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.note}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{formatTimestamp(item.createdAtUtc)}</p>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-6">
          <article className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Notifications</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Recent teacher-facing updates</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {loading ? "Loading" : `${state.notifications.length} items`}
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {state.notifications.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.message}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-200">{formatTimestamp(item.createdAtUtc)}</p>
                </article>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

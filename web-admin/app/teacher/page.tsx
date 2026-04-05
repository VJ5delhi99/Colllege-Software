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

type TeacherState = {
  attendancePercentage: number;
  totalCourses: number;
  nextCourse: string;
  teachingLoad: number;
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
  notifications: Array<{ id: string; title: string; message: string; createdAtUtc: string }>;
};

const demoState: TeacherState = {
  attendancePercentage: 88,
  totalCourses: 3,
  nextCourse: "Distributed Systems",
  teachingLoad: 3,
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
        if (demoMode) {
          if (!cancelled) {
            setState(demoState);
            setError(null);
            setLoading(false);
          }
          return;
        }

        const session = await getAdminSession();
        const headers = {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        };

        const [teacherSummaryResponse, attendanceResponse, coursesResponse, notificationsResponse, gradingResponse, advisingResponse, sessionsResponse, draftsResponse, publishingResponse] = await Promise.all([
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.attendance()}/api/v1/teachers/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/courses?facultyId=${session.user.id}&pageSize=10`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}&pageSize=5`, { headers }),
          fetch(`${apiConfig.exam()}/api/v1/teachers/${session.user.id}/grading-summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/advising-notes`, { headers }),
          fetch(`${apiConfig.attendance()}/api/v1/teachers/${session.user.id}/sessions?pageSize=6`, { headers }),
          fetch(`${apiConfig.lms()}/api/v1/teachers/${session.user.id}/content-drafts`, { headers }),
          fetch(`${apiConfig.exam()}/api/v1/teachers/${session.user.id}/publishing-queue`, { headers })
        ]);

        if (!teacherSummaryResponse.ok || !attendanceResponse.ok || !coursesResponse.ok || !notificationsResponse.ok || !gradingResponse.ok || !advisingResponse.ok || !sessionsResponse.ok || !draftsResponse.ok || !publishingResponse.ok) {
          throw new Error("Unable to load the teacher workspace.");
        }

        const [teacherSummaryPayload, attendancePayload, coursesPayload, notificationsPayload, gradingPayload, advisingPayload, sessionsPayload, draftsPayload, publishingPayload] = await Promise.all([
          teacherSummaryResponse.json(),
          attendanceResponse.json(),
          coursesResponse.json(),
          notificationsResponse.json(),
          gradingResponse.json(),
          advisingResponse.json(),
          sessionsResponse.json(),
          draftsResponse.json(),
          publishingResponse.json()
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
            notifications: notificationsPayload?.items ?? []
          });
          setError(null);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
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
          advisingNotes: [nextNote, ...current.advisingNotes].slice(0, 4)
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
        advisingNotes: [payload, ...current.advisingNotes].slice(0, 4)
      }));
      setError(null);
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Unable to add advising note.");
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

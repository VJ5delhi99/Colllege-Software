import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { AnimatedSurface } from "../components/AnimatedSurface";
import { getStudentSession } from "./auth-client";
import { apiConfig } from "./api-config";
import { isDemoModeEnabled } from "./demo-mode";

type AttendanceAlert = {
  courseCode: string;
  percentage: number;
  totalRecords: number;
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

type TeacherState = {
  totalCourses: number;
  teachingLoad: number;
  nextCourseTitle: string;
  nextCourseMeta: string;
  activeSessions: number;
  lowAttendanceCourses: number;
  learningMaterials: number;
  assignments: number;
  gradingPending: number;
  gradingReady: number;
  alerts: AttendanceAlert[];
  gradeReviews: GradeReviewItem[];
  advisingNotes: AdvisingNoteItem[];
  notifications: Array<{ id: string; title: string; message: string; createdAtUtc: string }>;
  error: string | null;
};

const demoState: TeacherState = {
  totalCourses: 3,
  teachingLoad: 3,
  nextCourseTitle: "Distributed Systems",
  nextCourseMeta: "B-204 - Monday - 02:00 PM",
  activeSessions: 1,
  lowAttendanceCourses: 1,
  learningMaterials: 2,
  assignments: 2,
  gradingPending: 1,
  gradingReady: 1,
  alerts: [
    { courseCode: "PHY201", percentage: 66.67, totalRecords: 3 },
    { courseCode: "CSE401", percentage: 100, totalRecords: 2 }
  ],
  gradeReviews: [
    {
      id: "grade-1",
      studentName: "Aarav Sharma",
      courseCode: "CSE401",
      assessmentName: "Lab Evaluation 1",
      status: "Pending Review",
      reviewerNote: "Need to double-check the replication diagram rubric."
    },
    {
      id: "grade-2",
      studentName: "Aarav Sharma",
      courseCode: "PHY201",
      assessmentName: "Internal Quiz 2",
      status: "Ready To Publish",
      reviewerNote: "Moderation completed."
    }
  ],
  advisingNotes: [
    {
      id: "note-1",
      studentName: "Aarav Sharma",
      courseCode: "PHY201",
      title: "Attendance recovery plan",
      note: "Student should attend the next two lab sessions and submit the missed worksheet.",
      followUpStatus: "Open",
      createdAtUtc: "2026-04-03T09:30:00Z"
    },
    {
      id: "note-2",
      studentName: "Aarav Sharma",
      courseCode: "CSE401",
      title: "Exam readiness counseling",
      note: "Asked student to focus on replication strategies and consistency trade-offs before the review.",
      followUpStatus: "Closed",
      createdAtUtc: "2026-04-04T12:00:00Z"
    }
  ],
  notifications: [
    {
      id: "teacher-note-1",
      title: "Faculty meeting on curriculum modernization",
      message: "Department heads and professors are requested to join the review session.",
      createdAtUtc: "2026-04-05T08:30:00Z"
    },
    {
      id: "teacher-note-2",
      title: "Assessment moderation window is open",
      message: "Finalize review comments before the exam board closes the publishing cycle.",
      createdAtUtc: "2026-04-04T15:00:00Z"
    }
  ],
  error: null
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export default function TeacherMobilePage() {
  const [state, setState] = useState<TeacherState>(demoState);
  const [busyId, setBusyId] = useState<string | null>(null);
  const demoMode = isDemoModeEnabled();

  useEffect(() => {
    if (demoMode) {
      setState(demoState);
      return;
    }

    getStudentSession()
      .then(async (session) => {
        const headers = {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        };
        const [summaryResponse, attendanceResponse, coursesResponse, notificationsResponse, gradingResponse, advisingResponse] = await Promise.all([
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.attendance()}/api/v1/teachers/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/courses?facultyId=${session.user.id}&pageSize=10`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}&pageSize=4`, { headers }),
          fetch(`${apiConfig.exam()}/api/v1/teachers/${session.user.id}/grading-summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/advising-notes`, { headers })
        ]);

        if (!summaryResponse.ok || !attendanceResponse.ok || !coursesResponse.ok || !notificationsResponse.ok || !gradingResponse.ok || !advisingResponse.ok) {
          throw new Error("Teacher mobile workspace is unavailable.");
        }

        const [summary, attendance, coursesPayload, notifications, grading, advising] = await Promise.all([
          summaryResponse.json(),
          attendanceResponse.json(),
          coursesResponse.json(),
          notificationsResponse.json(),
          gradingResponse.json(),
          advisingResponse.json()
        ]);
        const courseCodes = Array.from(new Set(((coursesPayload?.items ?? []) as Array<{ courseCode: string }>).map((item) => item.courseCode)));
        const lmsResponse = await fetch(
          `${apiConfig.lms()}/api/v1/workspace/summary${courseCodes.length > 0 ? `?courseCodes=${encodeURIComponent(courseCodes.join(","))}` : ""}`,
          { headers }
        );
        const lms = lmsResponse.ok ? await lmsResponse.json() : { materials: 0, assignments: 0 };

        setState({
          totalCourses: summary?.totalCourses ?? 0,
          teachingLoad: summary?.teachingLoad ?? 0,
          nextCourseTitle: summary?.nextCourse?.title ?? "No class scheduled",
          nextCourseMeta: summary?.nextCourse
            ? `${summary.nextCourse.room} - ${summary.nextCourse.dayOfWeek} - ${summary.nextCourse.startTime}`
            : "No course is queued right now.",
          activeSessions: attendance?.activeSessions ?? 0,
          lowAttendanceCourses: attendance?.lowAttendanceCourses ?? 0,
          learningMaterials: lms?.materials ?? 0,
          assignments: lms?.assignments ?? 0,
          gradingPending: grading?.pending ?? 0,
          gradingReady: grading?.readyToPublish ?? 0,
          alerts: attendance?.alerts ?? [],
          gradeReviews: grading?.items ?? [],
          advisingNotes: advising?.items ?? [],
          notifications: notifications?.items ?? [],
          error: null
        });
      })
      .catch(() => {
        setState((current) => ({
          ...current,
          error: "Teacher mobile workspace needs a professor session or demo mode."
        }));
      });
  }, [demoMode]);

  async function updateGradeReview(item: GradeReviewItem, status: string) {
    setBusyId(item.id);

    try {
      if (demoMode) {
        setState((current) => {
          const nextReviews = current.gradeReviews.map((review) => (review.id === item.id ? { ...review, status } : review));
          return {
            ...current,
            gradeReviews: nextReviews,
            gradingPending: nextReviews.filter((review) => review.status === "Pending Review").length,
            gradingReady: nextReviews.filter((review) => review.status === "Ready To Publish").length,
            error: null
          };
        });
        return;
      }

      const session = await getStudentSession();
      const response = await fetch(`${apiConfig.exam()}/api/v1/teachers/${session.user.id}/grade-reviews/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          status,
          reviewerNote: status === "Ready To Publish" ? "Teacher mobile review completed." : "Published from the teacher mobile workspace."
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
          gradingReady: nextReviews.filter((review) => review.status === "Ready To Publish").length,
          error: null
        };
      });
    } catch {
      setState((current) => ({
        ...current,
        error: "Teacher grading actions are unavailable right now."
      }));
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
          error: null
        }));
        return;
      }

      const session = await getStudentSession();
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
        error: null
      }));
    } catch {
      setState((current) => ({
        ...current,
        error: "Teacher advising actions are unavailable right now."
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#07111f" }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ color: "#c7d2fe", fontSize: 30, fontWeight: "700" }}>Teacher Mobile</Text>
        <Text style={{ color: "#9fb0c7", fontSize: 15 }}>Owned courses, attendance risk, and learning workload</Text>

        {state.error ? (
          <View style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(245, 158, 11, 0.14)", borderWidth: 1, borderColor: "rgba(245, 158, 11, 0.25)" }}>
            <Text style={{ color: "#fde68a" }}>{state.error}</Text>
          </View>
        ) : null}

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(71, 155, 255, 0.14)", borderWidth: 1, borderColor: "rgba(128, 214, 255, 0.25)" }}
        >
          <Text style={{ color: "#7dd3fc", fontSize: 13 }}>Next Class</Text>
          <Text style={{ color: "#eff6ff", fontSize: 22, fontWeight: "700", marginTop: 8 }}>{state.nextCourseTitle}</Text>
          <Text style={{ color: "#bfd3ea", marginTop: 10 }}>{state.nextCourseMeta}</Text>
        </AnimatedSurface>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {[
            { label: "Courses", value: state.totalCourses },
            { label: "Load", value: state.teachingLoad },
            { label: "Active Sessions", value: state.activeSessions },
            { label: "Alerts", value: state.lowAttendanceCourses },
            { label: "Pending Grades", value: state.gradingPending },
            { label: "Ready To Publish", value: state.gradingReady }
          ].map((card, index) => (
            <AnimatedSurface
              key={card.label}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 80 + index * 60, type: "timing", duration: 450 }}
              style={{ width: "47%", borderRadius: 22, padding: 18, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
            >
              <Text style={{ color: "#dbeafe", fontSize: 14 }}>{card.label}</Text>
              <Text style={{ color: "white", marginTop: 8, fontSize: 22, fontWeight: "700" }}>{card.value}</Text>
            </AnimatedSurface>
          ))}
        </View>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 220, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(245, 158, 11, 0.12)", borderWidth: 1, borderColor: "rgba(253, 224, 71, 0.18)" }}
        >
          <Text style={{ color: "#fde68a", fontSize: 13 }}>Faculty Workload</Text>
          <Text style={{ color: "#fff7ed", fontSize: 22, fontWeight: "700", marginTop: 8 }}>{state.learningMaterials} materials | {state.assignments} assignments</Text>
          <Text style={{ color: "#fed7aa", marginTop: 10 }}>Teaching content and attendance attention now travel together in the mobile teacher view.</Text>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 280, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Text style={{ color: "#7dd3fc", fontSize: 13 }}>Attendance Alerts</Text>
          <View style={{ marginTop: 14, gap: 12 }}>
            {state.alerts.map((item) => (
              <View key={`${item.courseCode}-${item.totalRecords}`} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#eff6ff", fontSize: 16, fontWeight: "700" }}>{item.courseCode}</Text>
                <Text style={{ color: "#bfd3ea", marginTop: 6 }}>{item.totalRecords} captured records in this course.</Text>
                <Text style={{ color: "#7dd3fc", marginTop: 8, fontSize: 12 }}>{item.percentage.toFixed(2)}% attendance</Text>
              </View>
            ))}
            {state.alerts.length === 0 ? <Text style={{ color: "#94a3b8" }}>No active attendance alerts are available.</Text> : null}
          </View>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 340, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Text style={{ color: "#fda4af", fontSize: 13 }}>Grading Queue</Text>
          <View style={{ marginTop: 14, gap: 12 }}>
            {state.gradeReviews.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#eff6ff", fontSize: 16, fontWeight: "700" }}>{item.studentName}</Text>
                <Text style={{ color: "#fecdd3", marginTop: 6 }}>{item.courseCode} | {item.assessmentName}</Text>
                <Text style={{ color: "#bfd3ea", marginTop: 6 }}>{item.reviewerNote}</Text>
                <Text style={{ color: "#7dd3fc", marginTop: 8, fontSize: 12 }}>{item.status}</Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  <Pressable
                    onPress={() => updateGradeReview(item, "Ready To Publish")}
                    disabled={busyId === item.id || item.status === "Ready To Publish" || item.status === "Published"}
                    style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(52, 211, 153, 0.16)", paddingHorizontal: 12, paddingVertical: 12, opacity: busyId === item.id || item.status === "Ready To Publish" || item.status === "Published" ? 0.5 : 1 }}
                  >
                    <Text style={{ color: "#d1fae5", fontWeight: "700", textAlign: "center" }}>{busyId === item.id ? "Working..." : "Mark Ready"}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateGradeReview(item, "Published")}
                    disabled={busyId === item.id || item.status === "Published"}
                    style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(125, 211, 252, 0.16)", paddingHorizontal: 12, paddingVertical: 12, opacity: busyId === item.id || item.status === "Published" ? 0.5 : 1 }}
                  >
                    <Text style={{ color: "#cffafe", fontWeight: "700", textAlign: "center" }}>{busyId === item.id ? "Working..." : "Publish"}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {state.gradeReviews.length === 0 ? <Text style={{ color: "#94a3b8" }}>No grading reviews are waiting right now.</Text> : null}
          </View>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 400, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Text style={{ color: "#67e8f9", fontSize: 13 }}>Advising Actions</Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <Pressable
              onPress={() => addAdvisingNote("PHY201", "Attendance intervention", "Student should attend the next two lab sessions and check in after the quiz review.")}
              disabled={busyId === "Attendance intervention"}
              style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(253, 224, 71, 0.16)", paddingHorizontal: 12, paddingVertical: 12, opacity: busyId === "Attendance intervention" ? 0.5 : 1 }}
            >
              <Text style={{ color: "#fef3c7", fontWeight: "700", textAlign: "center" }}>{busyId === "Attendance intervention" ? "Saving..." : "Attendance Plan"}</Text>
            </Pressable>
            <Pressable
              onPress={() => addAdvisingNote("CSE401", "Exam readiness counseling", "Recommended focused practice on consistency models before the next internal review.")}
              disabled={busyId === "Exam readiness counseling"}
              style={{ flex: 1, borderRadius: 14, backgroundColor: "rgba(34, 211, 238, 0.16)", paddingHorizontal: 12, paddingVertical: 12, opacity: busyId === "Exam readiness counseling" ? 0.5 : 1 }}
            >
              <Text style={{ color: "#cffafe", fontWeight: "700", textAlign: "center" }}>{busyId === "Exam readiness counseling" ? "Saving..." : "Exam Coaching"}</Text>
            </Pressable>
          </View>
          <View style={{ marginTop: 14, gap: 12 }}>
            {state.advisingNotes.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#eff6ff", fontSize: 16, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: "#67e8f9", marginTop: 6 }}>{item.studentName} | {item.courseCode}</Text>
                <Text style={{ color: "#bfd3ea", marginTop: 6 }}>{item.note}</Text>
                <Text style={{ color: "#7dd3fc", marginTop: 8, fontSize: 12 }}>{item.followUpStatus} | {formatTimestamp(item.createdAtUtc)}</Text>
              </View>
            ))}
            {state.advisingNotes.length === 0 ? <Text style={{ color: "#94a3b8" }}>No advising notes are available yet.</Text> : null}
          </View>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 460, type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Text style={{ color: "#7dd3fc", fontSize: 13 }}>Faculty Updates</Text>
          <View style={{ marginTop: 14, gap: 12 }}>
            {state.notifications.map((item) => (
              <View key={item.id} style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(7,17,31,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#eff6ff", fontSize: 16, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: "#bfd3ea", marginTop: 6 }}>{item.message}</Text>
                <Text style={{ color: "#7dd3fc", marginTop: 8, fontSize: 12 }}>{formatTimestamp(item.createdAtUtc)}</Text>
              </View>
            ))}
          </View>
        </AnimatedSurface>
      </ScrollView>
    </SafeAreaView>
  );
}

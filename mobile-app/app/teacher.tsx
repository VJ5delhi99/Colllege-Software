import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { AnimatedSurface } from "../components/AnimatedSurface";
import { getStudentSession } from "./auth-client";
import { apiConfig } from "./api-config";
import { isDemoModeEnabled } from "./demo-mode";

type AttendanceAlert = {
  courseCode: string;
  percentage: number;
  totalRecords: number;
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
  alerts: AttendanceAlert[];
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
  alerts: [
    { courseCode: "PHY201", percentage: 66.67, totalRecords: 3 },
    { courseCode: "CSE401", percentage: 100, totalRecords: 2 }
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
        const [summaryResponse, attendanceResponse, coursesResponse, notificationsResponse] = await Promise.all([
          fetch(`${apiConfig.academic()}/api/v1/teachers/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.attendance()}/api/v1/teachers/${session.user.id}/summary`, { headers }),
          fetch(`${apiConfig.academic()}/api/v1/courses?facultyId=${session.user.id}&pageSize=10`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}&pageSize=4`, { headers })
        ]);

        if (!summaryResponse.ok || !attendanceResponse.ok || !coursesResponse.ok || !notificationsResponse.ok) {
          throw new Error("Teacher mobile workspace is unavailable.");
        }

        const [summary, attendance, coursesPayload, notifications] = await Promise.all([
          summaryResponse.json(),
          attendanceResponse.json(),
          coursesResponse.json(),
          notificationsResponse.json()
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
          alerts: attendance?.alerts ?? [],
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
            { label: "Alerts", value: state.lowAttendanceCourses }
          ].map((card, index) => (
            <AnimatedSurface
              key={card.label}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 80 + index * 60, type: "timing", duration: 450 }}
              style={{ width: "48%", borderRadius: 22, padding: 18, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
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

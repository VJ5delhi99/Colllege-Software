import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { MotiView } from "moti";
import { Bell, CalendarDays, GraduationCap, ScanLine } from "lucide-react-native";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { getStudentSession } from "./auth-client";
import { apiConfig } from "./api-config";

type DashboardState = {
  attendance: string;
  results: string;
  announcements: string;
  schedule: string;
  principalBlogTitle: string;
  principalBlogBody: string;
  nextClassTitle: string;
  nextClassMeta: string;
  error: string | null;
};

const initialState: DashboardState = {
  attendance: "--",
  results: "--",
  announcements: "--",
  schedule: "--",
  principalBlogTitle: "Loading updates",
  principalBlogBody: "Fetching campus announcements and handbook highlights.",
  nextClassTitle: "Loading class",
  nextClassMeta: "Fetching schedule",
  error: null
};

export default function HomeScreen() {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    getStudentSession()
      .then((session) =>
        Promise.all([
          fetch(`${apiConfig.attendance()}/api/v1/students/${session.user.id}/summary`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId } }).then((response) => response.json()),
          fetch(`${apiConfig.exam()}/api/v1/results/${session.user.id}`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId } }).then((response) => response.json()),
          fetch(`${apiConfig.communication()}/api/v1/dashboard/summary`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId } }).then((response) => response.json()),
          fetch(`${apiConfig.academic()}/api/v1/dashboard/summary`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-Tenant-Id": session.user.tenantId } }).then((response) => response.json())
        ])
      )
      .then(([attendance, results, communication, academic]) => {
        const latestResult = Array.isArray(results) && results.length > 0 ? results[0] : null;
        setState({
          attendance: `${attendance?.percentage ?? 0}%`,
          results: latestResult ? `${latestResult.gpa} GPA` : "No GPA",
          announcements: `${communication?.total ?? 0} New`,
          schedule: academic?.nextCourse ? academic.nextCourse.startTime : "No class",
          principalBlogTitle: communication?.latest?.title ?? "No announcement available",
          principalBlogBody: communication?.latest?.body ?? "Campus communication feed is empty.",
          nextClassTitle: academic?.nextCourse?.title ?? "No class scheduled",
          nextClassMeta: academic?.nextCourse
            ? `${academic.nextCourse.room} - ${academic.nextCourse.startTime} - ${academic.nextCourse.courseCode}`
            : "Schedule service returned no upcoming class.",
          error: null
        });
      })
      .catch(() => {
        setState((current) => ({
          ...current,
          error: "Dashboard services are unavailable. Configure the required Expo environment variables and identity token flow."
        }));
      });
  }, []);

  const tiles = [
    { label: "Attendance", value: state.attendance, icon: ScanLine },
    { label: "Results", value: state.results, icon: GraduationCap },
    { label: "Announcements", value: state.announcements, icon: Bell },
    { label: "Schedule", value: state.schedule, icon: CalendarDays }
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#07111f" }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ color: "#c7d2fe", fontSize: 30, fontWeight: "700" }}>University360</Text>
        <Text style={{ color: "#9fb0c7", fontSize: 15 }}>AI-powered student cockpit</Text>

        {state.error ? (
          <View style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(245, 158, 11, 0.14)", borderWidth: 1, borderColor: "rgba(245, 158, 11, 0.25)" }}>
            <Text style={{ color: "#fde68a" }}>{state.error}</Text>
          </View>
        ) : null}

        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 500 }}
          style={{
            borderRadius: 24,
            padding: 20,
            backgroundColor: "rgba(71, 155, 255, 0.14)",
            borderWidth: 1,
            borderColor: "rgba(128, 214, 255, 0.25)"
          }}
        >
          <Text style={{ color: "#7dd3fc", fontSize: 14 }}>Principal Blog</Text>
          <Text style={{ color: "#eff6ff", fontSize: 22, fontWeight: "700", marginTop: 8 }}>
            {state.principalBlogTitle}
          </Text>
          <Text style={{ color: "#bfd3ea", marginTop: 10 }}>
            {state.principalBlogBody}
          </Text>
        </MotiView>

        <MotiView
          from={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 120, type: "timing", duration: 500 }}
          style={{
            borderRadius: 28,
            padding: 24,
            backgroundColor: "#0f1e35",
            shadowColor: "#22d3ee",
            shadowOpacity: 0.35,
            shadowRadius: 20
          }}
        >
          <Text style={{ color: "#67e8f9", fontSize: 13 }}>Current Class</Text>
          <Text style={{ color: "white", fontSize: 24, fontWeight: "700", marginTop: 8 }}>
            {state.nextClassTitle}
          </Text>
          <Text style={{ color: "#b6c7df", marginTop: 8 }}>{state.nextClassMeta}</Text>
        </MotiView>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {tiles.map((tile, index) => {
            const Icon = tile.icon;
            return (
              <MotiView
                key={tile.label}
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 180 + index * 80, type: "timing", duration: 450 }}
                style={{
                  width: "47%",
                  minHeight: 140,
                  padding: 18,
                  borderRadius: 22,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)"
                }}
              >
                <Icon color="#a5f3fc" size={22} />
                <Text style={{ color: "#dbeafe", marginTop: 18, fontSize: 14 }}>{tile.label}</Text>
                <Text style={{ color: "white", marginTop: 8, fontSize: 22, fontWeight: "700" }}>{tile.value}</Text>
              </MotiView>
            );
          })}
        </View>

        <Link href="/chat" asChild>
          <Pressable
            style={{
              marginTop: 6,
              borderRadius: 24,
              paddingHorizontal: 18,
              paddingVertical: 16,
              backgroundColor: "#22d3ee"
            }}
          >
            <Text style={{ color: "#082f49", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
              Open AI Assistant
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

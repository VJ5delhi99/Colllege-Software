import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Bell, CalendarDays, GraduationCap, ScanLine, Wallet } from "lucide-react-native";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { getStudentSession } from "./auth-client";
import { apiConfig } from "./api-config";
import { mobileDemoDashboardState } from "./demo-data";
import { isDemoModeEnabled } from "./demo-mode";
import { getMobileDemoDashboard, resetMobileDemoData } from "./demo-service";
import { AnimatedSurface } from "../components/AnimatedSurface";

type DashboardState = {
  attendance: string;
  results: string;
  announcements: string;
  schedule: string;
  finance: string;
  principalBlogTitle: string;
  principalBlogBody: string;
  nextClassTitle: string;
  nextClassMeta: string;
  paymentTitle: string;
  paymentMeta: string;
  notifications: Array<{ id: string; title: string; message: string; createdAtUtc: string }>;
  error: string | null;
};

const initialState: DashboardState = {
  attendance: "--",
  results: "--",
  announcements: "--",
  schedule: "--",
  finance: "--",
  principalBlogTitle: "Loading updates",
  principalBlogBody: "Fetching campus announcements and handbook highlights.",
  nextClassTitle: "Loading class",
  nextClassMeta: "Fetching schedule",
  paymentTitle: "Loading payments",
  paymentMeta: "Fetching finance posture",
  notifications: [],
  error: null
};

async function fetchJson(url: string, headers: HeadersInit) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return response.json();
}

function formatMoneyCompact(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1
  })
    .format(value)
    .replace(/\s+/g, "")}`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export default function HomeScreen() {
  const [state, setState] = useState(initialState);
  const [resetting, setResetting] = useState(false);
  const demoMode = isDemoModeEnabled();

  useEffect(() => {
    if (demoMode) {
      getMobileDemoDashboard()
        .then((dashboard) => {
          setState({
            ...dashboard,
            error: null
          });
        })
        .catch(() => {
          setState({
            ...mobileDemoDashboardState,
            error: "Demo dashboard reset is required."
          });
        });
      return;
    }

    getStudentSession()
      .then(async (session) => {
        const headers = {
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        };

        const [attendance, results, communication, academic, finance, notifications] = await Promise.all([
          fetchJson(`${apiConfig.attendance()}/api/v1/students/${session.user.id}/summary`, headers),
          fetchJson(`${apiConfig.exam()}/api/v1/students/${session.user.id}/summary`, headers),
          fetchJson(`${apiConfig.communication()}/api/v1/dashboard/summary`, headers),
          fetchJson(`${apiConfig.academic()}/api/v1/dashboard/summary`, headers),
          fetchJson(`${apiConfig.finance()}/api/v1/students/${session.user.id}/summary`, headers),
          fetchJson(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}&pageSize=3`, headers)
        ]);

        return { attendance, results, communication, academic, finance, notifications };
      })
      .then(({ attendance, results, communication, academic, finance, notifications }) => {
        const latestResult = results?.latest ?? null;
        const latestPayment = finance?.latestPayment ?? null;
        const latestSession = finance?.latestSession ?? null;
        setState({
          attendance: `${attendance?.percentage ?? 0}%`,
          results: latestResult ? `${latestResult.gpa} GPA` : `${results?.averageGpa ?? 0} GPA`,
          announcements: `${notifications?.items?.length ?? communication?.total ?? 0} Updates`,
          schedule: academic?.nextCourse ? academic.nextCourse.startTime : "No class",
          finance: formatMoneyCompact(finance?.totalPaid ?? 0),
          principalBlogTitle: communication?.latest?.title ?? "No announcement available",
          principalBlogBody: communication?.latest?.body ?? "Campus communication feed is empty.",
          nextClassTitle: academic?.nextCourse?.title ?? "No class scheduled",
          nextClassMeta: academic?.nextCourse
            ? `${academic.nextCourse.room} - ${academic.nextCourse.startTime} - ${academic.nextCourse.courseCode}`
            : "Schedule service returned no upcoming class.",
          paymentTitle: latestSession
            ? `Pending ${latestSession.invoiceNumber ?? "session"}`
            : latestPayment
              ? `Last paid ${latestPayment.invoiceNumber ?? "invoice"}`
              : "No finance activity",
          paymentMeta: latestSession
            ? `${latestSession.provider ?? "Gateway"} session is still waiting for completion.`
            : latestPayment
              ? `${latestPayment.currency ?? "INR"} ${latestPayment.amount ?? 0} paid via ${latestPayment.provider ?? "gateway"}.`
              : "No recent student payment activity was returned.",
          notifications: notifications?.items ?? [],
          error: null
        });
      })
      .catch(() => {
        setState((current) => ({
          ...current,
          error: "Dashboard services are unavailable. Configure the required Expo environment variables and identity token flow."
        }));
      });
  }, [demoMode]);

  async function handleResetDemo() {
    setResetting(true);
    await resetMobileDemoData();
    const dashboard = await getMobileDemoDashboard();
    setState({
      ...dashboard,
      error: null
    });
    setResetting(false);
  }

  const tiles = [
    { label: "Attendance", value: state.attendance, icon: ScanLine },
    { label: "Results", value: state.results, icon: GraduationCap },
    { label: "Announcements", value: state.announcements, icon: Bell },
    { label: "Schedule", value: state.schedule, icon: CalendarDays },
    { label: "Finance", value: state.finance, icon: Wallet }
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#07111f" }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ color: "#c7d2fe", fontSize: 30, fontWeight: "700" }}>University360</Text>
        <Text style={{ color: "#9fb0c7", fontSize: 15 }}>AI-powered student cockpit</Text>

        {demoMode ? (
          <View style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(34, 211, 238, 0.14)", borderWidth: 1, borderColor: "rgba(34, 211, 238, 0.25)" }}>
            <Text style={{ color: "#a5f3fc", fontWeight: "700" }}>You are in Demo Mode</Text>
            <Text style={{ color: "#cffafe", marginTop: 6 }}>Local seeded data is active and resets every 24 hours instead of calling live APIs.</Text>
            <Pressable onPress={handleResetDemo} disabled={resetting} style={{ marginTop: 12, alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#22d3ee", paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: "#082f49", fontWeight: "700" }}>{resetting ? "Resetting..." : "Reset Demo Data"}</Text>
            </Pressable>
          </View>
        ) : null}

        {state.error ? (
          <View style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(245, 158, 11, 0.14)", borderWidth: 1, borderColor: "rgba(245, 158, 11, 0.25)" }}>
            <Text style={{ color: "#fde68a" }}>{state.error}</Text>
          </View>
        ) : null}

        <AnimatedSurface
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
        </AnimatedSurface>

        <AnimatedSurface
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
        </AnimatedSurface>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {tiles.map((tile, index) => {
            const Icon = tile.icon;
            return (
              <AnimatedSurface
                key={tile.label}
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 180 + index * 80, type: "timing", duration: 450 }}
                style={{
                  width: "48%",
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
              </AnimatedSurface>
            );
          })}
        </View>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 420, type: "timing", duration: 450 }}
          style={{
            borderRadius: 24,
            padding: 20,
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(253, 224, 71, 0.18)"
          }}
        >
          <Text style={{ color: "#fde68a", fontSize: 13 }}>Finance Posture</Text>
          <Text style={{ color: "#fff7ed", fontSize: 22, fontWeight: "700", marginTop: 8 }}>
            {state.paymentTitle}
          </Text>
          <Text style={{ color: "#fed7aa", marginTop: 10 }}>
            {state.paymentMeta}
          </Text>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 520, type: "timing", duration: 450 }}
          style={{
            borderRadius: 24,
            padding: 20,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)"
          }}
        >
          <Text style={{ color: "#7dd3fc", fontSize: 13 }}>Recent Updates</Text>
          <View style={{ marginTop: 14, gap: 12 }}>
            {state.notifications.map((item) => (
              <View
                key={item.id}
                style={{
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: "rgba(7,17,31,0.55)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.06)"
                }}
              >
                <Text style={{ color: "#eff6ff", fontSize: 16, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: "#bfd3ea", marginTop: 6 }}>{item.message}</Text>
                <Text style={{ color: "#7dd3fc", marginTop: 8, fontSize: 12 }}>{formatTimestamp(item.createdAtUtc)}</Text>
              </View>
            ))}
            {state.notifications.length === 0 ? <Text style={{ color: "#94a3b8" }}>No recent updates are available.</Text> : null}
          </View>
        </AnimatedSurface>

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

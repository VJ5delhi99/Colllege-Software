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
  notifications: Array<{ id: string; title: string; message: string; createdAtUtc: string }>;
  error: string | null;
};

const initialState: DashboardState = {
  attendance: "--",
  results: "--",
  announcements: "--",
  schedule: "--",
  finance: "--",
  enrollments: "--",
  requests: "--",
  principalBlogTitle: "Loading updates",
  principalBlogBody: "Fetching campus announcements and handbook highlights.",
  nextClassTitle: "Loading class",
  nextClassMeta: "Fetching schedule",
  paymentTitle: "Loading payments",
  paymentMeta: "Fetching finance posture",
  studentOpsTitle: "Loading student services",
  studentOpsMeta: "Fetching self-service status",
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
  const [requesting, setRequesting] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
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

        const [attendance, results, communication, academic, finance, workspace, notifications] = await Promise.all([
          fetchJson(`${apiConfig.attendance()}/api/v1/students/${session.user.id}/summary`, headers),
          fetchJson(`${apiConfig.exam()}/api/v1/students/${session.user.id}/summary`, headers),
          fetchJson(`${apiConfig.communication()}/api/v1/dashboard/summary`, headers),
          fetchJson(`${apiConfig.academic()}/api/v1/dashboard/summary`, headers),
          fetchJson(`${apiConfig.student()}/api/v1/students/${session.user.id}/workspace`, headers),
          fetchJson(`${apiConfig.finance()}/api/v1/students/${session.user.id}/summary`, headers),
          fetchJson(`${apiConfig.communication()}/api/v1/notifications?audience=${encodeURIComponent(session.user.role)}&pageSize=3`, headers)
        ]);

        return { attendance, results, communication, academic, finance, workspace, notifications, headers };
      })
      .then(async ({ attendance, results, communication, academic, finance, workspace, notifications, headers }) => {
        const latestResult = results?.latest ?? null;
        const latestPayment = finance?.latestPayment ?? null;
        const latestSession = finance?.latestSession ?? null;
        const courseCodes = Array.from(new Set((workspace?.recentEnrollments ?? []).map((item: { courseCode: string }) => item.courseCode)));
        const lms = await fetchJson(
          `${apiConfig.lms()}/api/v1/workspace/summary${courseCodes.length > 0 ? `?courseCodes=${encodeURIComponent(courseCodes.join(","))}` : ""}`,
          headers
        ).catch(() => ({ materials: 0, assignments: 0 }));
        setState({
          attendance: `${attendance?.percentage ?? 0}%`,
          results: latestResult ? `${latestResult.gpa} GPA` : `${results?.averageGpa ?? 0} GPA`,
          announcements: `${notifications?.items?.length ?? communication?.total ?? 0} Updates`,
          schedule: academic?.nextCourse ? academic.nextCourse.startTime : "No class",
          finance: formatMoneyCompact(finance?.totalPaid ?? 0),
          enrollments: `${workspace?.enrollmentCount ?? 0} Courses`,
          requests: `${workspace?.openRequests ?? 0} Open`,
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
          studentOpsTitle: workspace?.recentRequests?.[0]?.title ?? "Student services are available",
          studentOpsMeta: workspace?.recentRequests?.[0]
            ? `${workspace.recentRequests[0].requestType} | ${workspace.recentRequests[0].status}`
            : `${lms?.materials ?? 0} materials and ${lms?.assignments ?? 0} assignments are currently in the learning queue.`,
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

  async function submitStudentRequest(requestType: string, title: string, description: string) {
    setRequesting(requestType);

    try {
      if (demoMode) {
        setState((current) => {
          const nextOpen = Number.parseInt(current.requests, 10);
          return {
            ...current,
            requests: `${Number.isNaN(nextOpen) ? 1 : nextOpen + 1} Open`,
            studentOpsTitle: title,
            studentOpsMeta: `${requestType} | Submitted`
          };
        });
        return;
      }

      const session = await getStudentSession();
      const response = await fetch(`${apiConfig.student()}/api/v1/students/${session.user.id}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          requestType,
          title,
          description
        })
      });

      if (!response.ok) {
        throw new Error("Unable to submit student request.");
      }

      setState((current) => {
        const nextOpen = Number.parseInt(current.requests, 10);
        return {
          ...current,
          requests: `${Number.isNaN(nextOpen) ? 1 : nextOpen + 1} Open`,
          studentOpsTitle: title,
          studentOpsMeta: `${requestType} | Submitted`
        };
      });
    } catch {
      setState((current) => ({
        ...current,
        error: "Student request submission is unavailable right now."
      }));
    } finally {
      setRequesting(null);
    }
  }

  async function startPaymentSession() {
    setPaying(true);

    try {
      if (demoMode) {
        setState((current) => ({
          ...current,
          finance: "INR 57K",
          paymentTitle: `Pending INV-${new Date().getFullYear()}-010`,
          paymentMeta: "Razorpay fee collection session is waiting for checkout completion."
        }));
        return;
      }

      const session = await getStudentSession();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
      const response = await fetch(`${apiConfig.finance()}/api/v1/students/${session.user.id}/payment-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          amount: 8000,
          currency: "INR",
          provider: "Razorpay",
          invoiceNumber
        })
      });

      if (!response.ok) {
        throw new Error("Unable to create payment session.");
      }

      const payload = await response.json();
      setState((current) => ({
        ...current,
        paymentTitle: `Pending ${payload?.invoiceNumber ?? invoiceNumber}`,
        paymentMeta: `${payload?.provider ?? "Gateway"} session is still waiting for completion.`,
        error: null
      }));
    } catch {
      setState((current) => ({
        ...current,
        error: "Student payment session creation is unavailable right now."
      }));
    } finally {
      setPaying(false);
    }
  }

  const tiles = [
    { label: "Attendance", value: state.attendance, icon: ScanLine },
    { label: "Results", value: state.results, icon: GraduationCap },
    { label: "Announcements", value: state.announcements, icon: Bell },
    { label: "Schedule", value: state.schedule, icon: CalendarDays },
    { label: "Finance", value: state.finance, icon: Wallet },
    { label: "Enrollments", value: state.enrollments, icon: GraduationCap },
    { label: "Requests", value: state.requests, icon: Bell }
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
          transition={{ delay: 340, type: "timing", duration: 450 }}
          style={{
            borderRadius: 24,
            padding: 20,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)"
          }}
        >
          <Text style={{ color: "#7dd3fc", fontSize: 13 }}>Role Workspaces</Text>
          <Text style={{ color: "#e2e8f0", marginTop: 8 }}>
            Mobile parity now extends beyond the student dashboard with dedicated teacher and admin summaries.
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <Link href="/teacher" asChild>
              <Pressable style={{ flex: 1, borderRadius: 18, backgroundColor: "rgba(34, 211, 238, 0.14)", paddingHorizontal: 14, paddingVertical: 14 }}>
                <Text style={{ color: "#cffafe", fontWeight: "700", textAlign: "center" }}>Teacher</Text>
              </Pressable>
            </Link>
            <Link href="/admin" asChild>
              <Pressable style={{ flex: 1, borderRadius: 18, backgroundColor: "rgba(217, 70, 239, 0.14)", paddingHorizontal: 14, paddingVertical: 14 }}>
                <Text style={{ color: "#f5d0fe", fontWeight: "700", textAlign: "center" }}>Admin</Text>
              </Pressable>
            </Link>
          </View>
        </AnimatedSurface>

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
          <Pressable
            onPress={startPaymentSession}
            disabled={paying}
            style={{ marginTop: 14, alignSelf: "flex-start", borderRadius: 18, backgroundColor: "rgba(253, 224, 71, 0.18)", paddingHorizontal: 14, paddingVertical: 12, opacity: paying ? 0.5 : 1 }}
          >
            <Text style={{ color: "#fef3c7", fontWeight: "700" }}>{paying ? "Preparing..." : "Start Fee Payment"}</Text>
          </Pressable>
        </AnimatedSurface>

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 470, type: "timing", duration: 450 }}
          style={{
            borderRadius: 24,
            padding: 20,
            backgroundColor: "rgba(34, 197, 94, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(134, 239, 172, 0.18)"
          }}
        >
          <Text style={{ color: "#bbf7d0", fontSize: 13 }}>Student Self-Service</Text>
          <Text style={{ color: "#f0fdf4", fontSize: 22, fontWeight: "700", marginTop: 8 }}>
            {state.studentOpsTitle}
          </Text>
          <Text style={{ color: "#dcfce7", marginTop: 10 }}>
            {state.studentOpsMeta}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <Pressable
              onPress={() => submitStudentRequest("Bonafide Letter", "Need bonafide letter for internship verification", "Requested from the mobile student cockpit.")}
              disabled={requesting !== null}
              style={{ flex: 1, borderRadius: 18, backgroundColor: "rgba(187, 247, 208, 0.16)", paddingHorizontal: 14, paddingVertical: 14 }}
            >
              <Text style={{ color: "#dcfce7", fontWeight: "700", textAlign: "center" }}>{requesting === "Bonafide Letter" ? "Submitting..." : "Bonafide"}</Text>
            </Pressable>
            <Pressable
              onPress={() => submitStudentRequest("Transcript Certificate", "Official transcript for graduate application", "Requested from the mobile student cockpit.")}
              disabled={requesting !== null}
              style={{ flex: 1, borderRadius: 18, backgroundColor: "rgba(125, 211, 252, 0.16)", paddingHorizontal: 14, paddingVertical: 14 }}
            >
              <Text style={{ color: "#cffafe", fontWeight: "700", textAlign: "center" }}>{requesting === "Transcript Certificate" ? "Submitting..." : "Transcript"}</Text>
            </Pressable>
          </View>
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

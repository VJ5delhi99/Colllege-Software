import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { AnimatedSurface } from "../components/AnimatedSurface";
import { getStudentSession } from "./auth-client";
import { apiConfig } from "./api-config";
import { isDemoModeEnabled } from "./demo-mode";

type AdminState = {
  campuses: number;
  programs: number;
  inquiries: number;
  applications: number;
  pendingDocs: number;
  feeCollection: number;
  error: string | null;
};

const demoState: AdminState = {
  campuses: 3,
  programs: 6,
  inquiries: 2,
  applications: 2,
  pendingDocs: 1,
  feeCollection: 57000,
  error: null
};

function formatMoney(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

export default function AdminMobilePage() {
  const [state, setState] = useState<AdminState>(demoState);
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
        const [organizationResponse, admissionsResponse, financeResponse] = await Promise.all([
          fetch(`${apiConfig.organization()}/api/v1/catalog/summary`, { headers }),
          fetch(`${apiConfig.communication()}/api/v1/admissions/summary`, { headers }),
          fetch(`${apiConfig.finance()}/api/v1/payments/summary`, { headers })
        ]);

        if (!organizationResponse.ok || !admissionsResponse.ok || !financeResponse.ok) {
          throw new Error("Admin mobile workspace is unavailable.");
        }

        const [organization, admissions, finance] = await Promise.all([organizationResponse.json(), admissionsResponse.json(), financeResponse.json()]);
        setState({
          campuses: organization?.campuses ?? 0,
          programs: organization?.programs ?? 0,
          inquiries: admissions?.total ?? 0,
          applications: admissions?.applications?.total ?? 0,
          pendingDocs: admissions?.documents?.pending ?? 0,
          feeCollection: finance?.totalCollected ?? 0,
          error: null
        });
      })
      .catch(() => {
        setState((current) => ({
          ...current,
          error: "Admin mobile workspace needs an admin session or demo mode."
        }));
      });
  }, [demoMode]);

  const cards = [
    { label: "Campuses", value: state.campuses.toString() },
    { label: "Programs", value: state.programs.toString() },
    { label: "Inquiries", value: state.inquiries.toString() },
    { label: "Applications", value: state.applications.toString() }
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#07111f" }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ color: "#c7d2fe", fontSize: 30, fontWeight: "700" }}>Admin Mobile</Text>
        <Text style={{ color: "#9fb0c7", fontSize: 15 }}>Catalog coverage, admissions load, and finance posture</Text>

        {state.error ? (
          <View style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(245, 158, 11, 0.14)", borderWidth: 1, borderColor: "rgba(245, 158, 11, 0.25)" }}>
            <Text style={{ color: "#fde68a" }}>{state.error}</Text>
          </View>
        ) : null}

        <AnimatedSurface
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 450 }}
          style={{ borderRadius: 24, padding: 20, backgroundColor: "rgba(217, 70, 239, 0.14)", borderWidth: 1, borderColor: "rgba(244, 114, 182, 0.18)" }}
        >
          <Text style={{ color: "#f5d0fe", fontSize: 13 }}>Executive Summary</Text>
          <Text style={{ color: "#fff7ed", fontSize: 22, fontWeight: "700", marginTop: 8 }}>Fee collection {formatMoney(state.feeCollection)}</Text>
          <Text style={{ color: "#fbcfe8", marginTop: 10 }}>{state.pendingDocs} applicant documents still need review before offer readiness.</Text>
        </AnimatedSurface>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {cards.map((card, index) => (
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
      </ScrollView>
    </SafeAreaView>
  );
}

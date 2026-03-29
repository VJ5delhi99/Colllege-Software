import { useState } from "react";
import { SafeAreaView, ScrollView, Text, TextInput, Pressable, View } from "react-native";
import { getStudentSession } from "./auth-client";
import { apiConfig } from "./api-config";
import { getMobileDemoReply } from "./demo-data";
import { isDemoModeEnabled } from "./demo-mode";
import { AnimatedSurface } from "../components/AnimatedSurface";

const suggestedPrompts = [
  "Check my attendance",
  "Show my results",
  "Latest announcements",
  "Today's schedule"
];

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    { id: "1", role: "assistant", text: "Ask about attendance, results, announcements, or university rules." }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const demoMode = isDemoModeEnabled();

  const nextId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const endpoint = apiConfig.assistant();

  const sendMessage = async (message: string) => {
    if (!message.trim()) {
      return;
    }

    setMessages((current) => [...current, { id: nextId(), role: "user", text: message }]);
    setInput("");
    setIsTyping(true);

    try {
      if (demoMode) {
        setMessages((current) => [...current, { id: nextId(), role: "assistant", text: getMobileDemoReply(message) }]);
        return;
      }

      const session = await getStudentSession();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
          "X-Tenant-Id": session.user.tenantId
        },
        body: JSON.stringify({
          message,
          userId: session.user.id
        })
      });

      const payload = await response.json().catch(() => null);
      const text = response.ok && payload?.reply
        ? payload.reply
        : "Assistant service is unreachable or rejected the request. Verify the configured API URLs and token flow.";

      setMessages((current) => [...current, { id: nextId(), role: "assistant", text }]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: "assistant",
          text: "Assistant service is unreachable or rejected the request. Verify the configured API URLs and token flow."
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#04101d" }}>
      <View style={{ padding: 20, paddingBottom: 8 }}>
        <Text style={{ color: "#cffafe", fontSize: 28, fontWeight: "700" }}>Campus AI</Text>
        <Text style={{ color: "#94a3b8", marginTop: 6 }}>Role-aware assistant for university workflows</Text>
        {demoMode ? <Text style={{ color: "#67e8f9", marginTop: 6 }}>Demo mode is active. Assistant replies are coming from seeded local data.</Text> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {suggestedPrompts.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => sendMessage(prompt)}
              disabled={isTyping}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(165,243,252,0.25)",
                backgroundColor: "rgba(8,47,73,0.9)",
                paddingHorizontal: 14,
                paddingVertical: 10
              }}
            >
              <Text style={{ color: "#bae6fd" }}>{prompt}</Text>
            </Pressable>
          ))}
        </View>

        {messages.map((message, index) => (
          <AnimatedSurface
            key={message.id}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: index * 60, type: "timing", duration: 260 }}
            style={{
              alignSelf: message.role === "assistant" ? "flex-start" : "flex-end",
              maxWidth: "84%",
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: message.role === "assistant" ? "#0f172a" : "#0891b2"
            }}
          >
            <Text style={{ color: "white", lineHeight: 20 }}>{message.text}</Text>
          </AnimatedSurface>
        ))}

        {isTyping ? (
          <View style={{ alignSelf: "flex-start", borderRadius: 20, backgroundColor: "#0f172a", padding: 14 }}>
            <Text style={{ color: "#a5f3fc" }}>AI is typing...</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 16,
          flexDirection: "row",
          gap: 10,
          borderRadius: 24,
          backgroundColor: "#0f172a",
          padding: 10
        }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask University360 AI..."
          placeholderTextColor="#64748b"
          style={{ flex: 1, color: "white", paddingHorizontal: 12, paddingVertical: 10 }}
        />
        <Pressable
          onPress={() => sendMessage(input)}
          disabled={isTyping || !input.trim()}
          style={{ borderRadius: 18, backgroundColor: "#22d3ee", paddingHorizontal: 18, justifyContent: "center" }}
        >
          <Text style={{ color: "#082f49", fontWeight: "700" }}>Send</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// src/components/navigate/NavAlert.tsx
//
// Hari 3 Task 2: peringatan navigasi berupa TEKS BESAR (+ getar, dipicu di
// navigate.tsx) — tidak bergantung audio (diusulkan untuk profil
// tunarungu). Diumumkan ke pembaca layar (live region), hilang sendiri, dan
// bisa ditutup dengan mengetuknya.
import Text from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";

export interface NavAlertContent {
  title: string;
  detail: string;
  kind: "step" | "arrived";
}

export default function NavAlert({ alert, onDismiss }: { alert: NavAlertContent; onDismiss: () => void }) {
  const arrived = alert.kind === "arrived";
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${alert.title}. ${alert.detail}. Ketuk untuk menutup.`}
      className="absolute left-3 right-3 z-30 rounded-3xl px-5 py-5 gap-2 flex-row items-start"
      style={{
        top: 52,
        backgroundColor: arrived ? "#065F46" : "#0F3FC1",
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 14,
      }}
    >
      <Ionicons name={arrived ? "flag" : "notifications"} size={34} color="#FFFFFF" style={{ marginTop: 2 }} />
      <Pressable className="flex-1 gap-1" onPress={onDismiss} accessible={false}>
        <Text className="text-2xl" weight="bold" style={{ color: "#FFFFFF", lineHeight: 30 }}>
          {alert.title}
        </Text>
        <Text className="text-lg" style={{ color: "#FFFFFF", lineHeight: 25 }}>
          {alert.detail}
        </Text>
      </Pressable>
    </Pressable>
  );
}

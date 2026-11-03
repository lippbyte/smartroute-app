// Kartu akun di Profil. Hari 1 Task 2: data asli dari sesi login (sebelumnya
// teks statis "Tipe Perjalananmu: Hemat & Nyaman"). Tamu melihat ajakan
// Masuk / Daftar — tanpa menghalangi fitur lain.
import { useAuth } from "@/context/AuthContext";
import PrimaryButton from "@/components/form/PrimaryButton";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Text from "./Text";
import { t } from "@/i18n";

export default function AccountCard() {
  const router = useRouter();
  const { status, user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (status !== "signedIn" || !user) {
    return (
      <View className="bg-surface border border-line w-full px-4 py-4 rounded-2xl gap-4">
        <View className="flex-row items-center gap-4">
          <View
            className="items-center justify-center"
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#E5E7EB" }}
          >
            <Ionicons name="person-outline" size={28} color="#404040" />
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-ink text-base" weight="bold">
              {t("account.guestTitle")}
            </Text>
            <Text className="text-ink-2 text-sm">{t("account.guestBody")}</Text>
          </View>
        </View>
        <PrimaryButton label={t("common.signInOrUp")} onPress={() => router.push("/login")} />
      </View>
    );
  }

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <View className="flex-row items-center gap-4 bg-surface border border-line w-full px-4 py-4 rounded-2xl">
      <View
        className="items-center justify-center"
        style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,135,90,0.2)" }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Text className="text-2xl" weight="bold" style={{ color: "#065F46" }}>
          {initial}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-ink text-lg" weight="bold" numberOfLines={1}>
          {user.name}
        </Text>
        <Text className="text-ink-2 text-sm" numberOfLines={1}>
          {user.email}
        </Text>
      </View>
      <Pressable
        onPress={async () => {
          setSigningOut(true);
          await signOut();
        }}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel={t("account.signOutLabel")}
        hitSlop={6}
        className="flex-row items-center gap-1.5 px-3.5 py-2.5 rounded-xl active:opacity-70"
        style={{ borderWidth: 1.5, borderColor: "#B91C1C" }}
      >
        <Ionicons name="log-out-outline" size={18} color="#B91C1C" />
        <Text className="text-sm" weight="bold" style={{ color: "#B91C1C" }}>
          {t("account.signOut")}
        </Text>
      </Pressable>
    </View>
  );
}

// src/components/form/AuthScreenLayout.tsx
//
// Hari 1 Task 2: kerangka layar Masuk/Daftar/Onboarding. Form di dalam
// ScrollView supaya tombol bisa digulir ke atas keyboard; tap tombol saat
// keyboard terbuka tetap diproses (keyboardShouldPersistTaps="handled" —
// pelajaran Task App-09: tanpa ini, di NATIVE tap pertama hanya menutup
// keyboard). KeyboardAvoidingView mengikuti pola assistant.tsx (padding di
// iOS; Android memakai resize bawaan jendela).
import ScreenBackground from "@/components/ScreenBackground";
import Text from "@/components/Text";
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Di bawah kartu (mis. tombol tamu), di atas latar gelap. */
  footer?: ReactNode;
}

export default function AuthScreenLayout({ title, subtitle, children, footer }: Props) {
  return (
    <ScreenBackground>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 48, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center gap-1">
            <Text className="text-white text-base" weight="semibold">
              SmartRoute AI
            </Text>
          </View>
          <View className="bg-surface rounded-3xl px-5 py-6 gap-5 border border-line">
            <View className="gap-1.5">
              <Text className="text-ink text-2xl" weight="bold" accessibilityRole="header">
                {title}
              </Text>
              {subtitle && <Text className="text-ink-2 text-[15px]">{subtitle}</Text>}
            </View>
            {children}
          </View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

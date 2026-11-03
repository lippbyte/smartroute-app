// src/components/LanguagePicker.tsx
//
// Task B: pilihan bahasa di Profil (kartu, dengan catatan jujur soal teks server)
// dan di layar Masuk (di atas latar gelap, supaya bisa dipilih sebelum masuk).
import Text from "@/components/Text";
import { LANGUAGE_OPTIONS, setLanguage, t, useLanguage } from "@/i18n";
import { Pressable, View } from "react-native";

export default function LanguagePicker({ onDark }: { onDark?: boolean }) {
  const language = useLanguage();

  return (
    <View className={onDark ? "items-center gap-2" : "bg-surface w-full px-5 py-4 rounded-2xl border border-line gap-3"}>
      <Text
        className={onDark ? "text-sm" : "text-ink font-bold text-lg"}
        weight={onDark ? "semibold" : undefined}
        style={onDark ? { color: "#FFFFFF" } : undefined}
        accessibilityRole="header"
      >
        {t("language.title")}
      </Text>
      <View className="flex-row flex-wrap justify-center gap-2" accessibilityRole="radiogroup" accessibilityLabel={t("language.title")}>
        {LANGUAGE_OPTIONS.map((option) => {
          const selected = language === option.value;
          const color = selected ? "#FFFFFF" : onDark ? "#FFFFFF" : "#0A0A0A";
          return (
            <Pressable
              key={option.value}
              onPress={() => setLanguage(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              className="rounded-full px-4 justify-center active:opacity-80"
              style={{
                minHeight: 44,
                backgroundColor: selected ? "#0F3FC1" : onDark ? "rgba(255,255,255,0.08)" : "#FFFFFF",
                borderWidth: 1.5,
                borderColor: selected ? "#0F3FC1" : onDark ? "#FFFFFF" : "#737373",
              }}
            >
              <Text className="text-sm" weight="semibold" style={{ color }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!onDark && <Text className="text-ink-2 text-xs">{t("language.note")}</Text>}
    </View>
  );
}

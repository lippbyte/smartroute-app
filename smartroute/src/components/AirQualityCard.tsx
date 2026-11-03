// src/components/AirQualityCard.tsx
//
// Hari 2 Task 3: info kualitas udara Jakarta (IQAir, tingkat kota). Tidak
// dirender sama sekali bila data tidak tersedia (tanpa galat ke pengguna).
// stale -> "data tidak terbaru". Saran satu kalimat, bukan saran medis.
// Dengan onPress, kartu bisa diketuk untuk membuka layar detail.
import Text from "@/components/Text";
import { AQI_ADVICE, AQI_COLORS, type AirQuality } from "@/services/airQualityService";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { t } from "@/i18n";

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function AirQualityCard({ air, compact, onPress }: { air: AirQuality | null; compact?: boolean; onPress?: () => void }) {
  if (!air) return null;
  const colors = AQI_COLORS[air.category_key];
  const updated = t("air.updated", { time: hhmm(air.fetched_at) });
  const label = t("air.cardLabel", { city: air.city, category: air.category, aqi: air.aqi_us, stale: air.stale ? `${t("air.staleSentence")} ` : "", updated });

  const content = (
    <>
      <View className="rounded-xl items-center justify-center" style={{ backgroundColor: colors.bg, width: compact ? 44 : 52, height: compact ? 44 : 52 }}>
        <Text className={compact ? "text-base" : "text-lg"} weight="bold" style={{ color: colors.text }}>
          {air.aqi_us}
        </Text>
        <Text className="text-[9px]" weight="semibold" style={{ color: colors.text }}>
          AQI
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5 flex-wrap">
          <Text className="text-ink text-sm" weight="bold">
            {t("air.title", { city: air.city, category: air.category })}
          </Text>
          {air.stale && (
            <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: "#F4F4F0", borderWidth: 1, borderColor: "#737373" }}>
              <Ionicons name="time-outline" size={11} color="#404040" />
              <Text className="text-[11px]" weight="semibold" style={{ color: "#404040" }}>
                {t("air.staleChip")}
              </Text>
            </View>
          )}
        </View>
        {!compact && <Text className="text-ink-2 text-sm">{AQI_ADVICE[air.category_key]}</Text>}
        <Text className="text-ink-2 text-xs">
          {updated}
          {air.pollutant_main ? ` · ${t("air.mainPollutantValue", { value: air.pollutant_main })}` : ""}
        </Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color="#737373" style={{ alignSelf: "center" }} />}
    </>
  );

  const className = "w-full bg-surface rounded-2xl border border-line flex-row items-start gap-3";
  const padding = { padding: compact ? 12 : 16 };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t("air.openHint")}
        className={`${className} active:opacity-80`}
        style={padding}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className={className} style={padding} accessible accessibilityLabel={label}>
      {content}
    </View>
  );
}

// src/components/AirQualityCard.tsx
//
// Hari 2 Task 3: info kualitas udara Jakarta (IQAir, tingkat kota). Tidak
// dirender sama sekali bila data tidak tersedia (tanpa galat ke pengguna).
// stale -> "data tidak terbaru". Saran satu kalimat, bukan saran medis.
import Text from "@/components/Text";
import { AQI_ADVICE, AQI_COLORS, type AirQuality } from "@/services/airQualityService";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function AirQualityCard({ air, compact }: { air: AirQuality | null; compact?: boolean }) {
  if (!air) return null;
  const colors = AQI_COLORS[air.category_key];
  const updated = `Diperbarui ${hhmm(air.fetched_at)} · Sumber: IQAir`;

  return (
    <View
      className="w-full bg-surface rounded-2xl border border-line flex-row items-start gap-3"
      style={{ padding: compact ? 12 : 16 }}
      accessible
      accessibilityLabel={`Kualitas udara ${air.city}: ${air.category}, AQI ${air.aqi_us}. ${air.stale ? "Data tidak terbaru. " : ""}${updated}.`}
    >
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
            Udara {air.city}: {air.category}
          </Text>
          {air.stale && (
            <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: "#F4F4F0", borderWidth: 1, borderColor: "#737373" }}>
              <Ionicons name="time-outline" size={11} color="#404040" />
              <Text className="text-[11px]" weight="semibold" style={{ color: "#404040" }}>
                data tidak terbaru
              </Text>
            </View>
          )}
        </View>
        {!compact && <Text className="text-ink-2 text-sm">{AQI_ADVICE[air.category_key]}</Text>}
        <Text className="text-ink-2 text-xs">
          {updated}
          {air.pollutant_main ? ` · Polutan utama ${air.pollutant_main}` : ""}
        </Text>
      </View>
    </View>
  );
}

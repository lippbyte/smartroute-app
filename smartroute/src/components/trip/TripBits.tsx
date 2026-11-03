// src/components/trip/TripBits.tsx
//
// Hari 1 Task 5: potongan tampilan perjalanan yang dipakai Ringkasan,
// Riwayat, dan Detail — supaya label durasi (Aktual/Estimasi) dan ikon
// moda selalu sama di ketiganya.
import Text from "@/components/Text";
import { legModeStyle } from "@/components/transit/legModes";
import type { DurationDisplay } from "@/utils/tripFormat";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { t } from "@/i18n";

/** Rangkaian ikon moda (jalan kaki ikut ditampilkan, berurutan). */
export function LegChain({ modes, size = 15 }: { modes: string[]; size?: number }) {
  const labels = modes.map((m) => legModeStyle(m).label).join(`, ${t("trip.modesThen")} `);
  return (
    <View className="flex-row items-center flex-wrap gap-1" accessible accessibilityLabel={t("trip.modesLabel", { labels })}>
      {modes.map((m, i) => {
        const style = legModeStyle(m);
        return (
          <View key={`${m}-${i}`} className="flex-row items-center gap-1">
            <View
              className="rounded-lg items-center justify-center"
              style={{ width: size + 13, height: size + 13, backgroundColor: `${style.color}26` }}
            >
              <Ionicons name={style.icon} size={size} color={style.color === "#FFFFFF" ? "#404040" : style.color} />
            </View>
            {i < modes.length - 1 && <Ionicons name="chevron-forward" size={12} color="#737373" />}
          </View>
        );
      })}
    </View>
  );
}

/** "Aktual 41 mnt · Prediksi 75–87 mnt" atau "Estimasi 75–87 mnt". */
export function DurationBadge({ display, compact }: { display: DurationDisplay; compact?: boolean }) {
  const isActual = display.label === "Aktual";
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-1.5 flex-wrap">
        <View
          className="rounded-full px-2.5 py-1"
          style={{ backgroundColor: isActual ? "#D1FAE5" : "#F4F4F0", borderWidth: 1, borderColor: isActual ? "#065F46" : "#737373" }}
        >
          <Text className="text-xs" weight="bold" style={{ color: isActual ? "#065F46" : "#404040" }}>
            {t(isActual ? "trip.actual" : "trip.estimate")}
          </Text>
        </View>
        <Text className={compact ? "text-ink text-sm" : "text-ink text-base"} weight="bold">
          {display.value}
        </Text>
      </View>
      {isActual && display.predicted && (
        <Text className="text-ink-2 text-xs">{t("trip.predicted", { value: display.predicted })}</Text>
      )}
    </View>
  );
}

/** Penjelasan singkat arti label — ditampilkan di Ringkasan & Detail. */
export function durationNote(display: DurationDisplay): string {
  return display.label === "Aktual"
    ? t("trip.noteActual")
    : t("trip.noteEstimate");
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View className="flex-row items-center gap-0.5" accessible accessibilityLabel={t("rating.stars", { n: value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= value ? "star" : "star-outline"} size={size} color={n <= value ? "#B45309" : "#A3A3A3"} />
      ))}
    </View>
  );
}

// Kartu progres perjalanan di bawah peta, ala Google Maps: sisa waktu besar,
// jarak & jam tiba, progres per leg berwarna moda, tombol keluar. Bisa
// dibuka untuk melihat semua langkah (tap untuk lompat ke langkah itu) dan
// info kepadatan/reliabilitas.
import Text from "@/components/Text";
import { legModeStyle } from "@/components/transit/legModes";
import { RouteItem } from "@/type";
import {
  boardText,
  formatClock,
  formatDistance,
  isWalkLeg,
  legDurationMin,
} from "@/utils/navInstructions";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { LayoutChangeEvent, Pressable, ScrollView, View } from "react-native";
import { t } from "@/i18n";

interface Props {
  route: RouteItem;
  currentLegIndex: number;
  currentLegFraction: number;
  remainingMin: number;
  remainingM: number;
  onSelectLeg: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}

const CROWD_TEXT: Record<string, { label: string; color: string }> = {
  LOW: {
    get label() {
      return t("nav.crowd.low");
    },
    color: "#4ADE80",
  },
  MEDIUM: {
    get label() {
      return t("nav.crowd.medium");
    },
    color: "#FACC15",
  },
  HIGH: {
    get label() {
      return t("nav.crowd.high");
    },
    color: "#F87171",
  },
};

export default function NavPanel({
  route,
  currentLegIndex,
  currentLegFraction,
  remainingMin,
  remainingM,
  onSelectLeg,
  onPrev,
  onNext,
  onExit,
  onLayout,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const legs = route.legs;
  const arrival = formatClock(legs[legs.length - 1]?.arrive_at);
  const isLast = currentLegIndex >= legs.length - 1;
  const crowd = route.crowd ? CROWD_TEXT[route.crowd.current_level] : null;

  // Bobot tiap leg di bar progres = durasinya, supaya leg MRT 20 menit tidak
  // tampak sama panjang dengan jalan kaki 1 menit.
  const weights = legs.map((l) => legDurationMin(l) ?? 1);

  return (
    <View
      onLayout={onLayout}
      className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl px-5 pt-2.5 pb-7 gap-3 border-t border-line"
      style={{ maxHeight: "70%" }}
    >
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        className="items-center py-1"
        accessibilityRole="button"
        accessibilityLabel={expanded ? t("nav.closeSteps") : t("nav.openSteps")}
      >
        <View className="w-10 h-1 rounded-full bg-line" />
      </Pressable>

      {/* Ringkasan: sisa waktu, jarak, jam tiba + tombol keluar */}
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-2xl font-bold" style={{ color: "#018959" }}>
            {t("format.minutes", { n: remainingMin })}
          </Text>
          <Text className="text-muted text-sm">
            {formatDistance(remainingM)}
            {arrival ? ` · ${t("nav.scheduledArrival", { time: arrival })}` : ""}
          </Text>
        </View>
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          className="w-11 h-11 rounded-full bg-surface-2 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={t("nav.steps")}
        >
          <Ionicons name={expanded ? "chevron-down" : "list"} size={20} color="#404040" />
        </Pressable>
        <Pressable
          onPress={onExit}
          className="px-4 h-11 rounded-full items-center justify-center"
          style={{ backgroundColor: "#DC2626" }}
          accessibilityRole="button"
          accessibilityLabel={t("nav.exitLabel")}
        >
          <Text className="font-bold text-sm" style={{ color: "#FFFFFF" }}>
            {t("nav.exit")}
          </Text>
        </Pressable>
      </View>

      {/* Progres per leg, warna moda. Leg aktif terisi sesuai posisi GPS. */}
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onPrev}
          disabled={currentLegIndex === 0}
          hitSlop={8}
          accessibilityLabel={t("nav.prev")}
          style={{ opacity: currentLegIndex === 0 ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-back-circle" size={26} color="#404040" />
        </Pressable>
        <View className="flex-1 flex-row gap-1 h-2">
          {legs.map((leg, i) => {
            const color = legModeStyle(leg.mode).color;
            const fill = i < currentLegIndex ? 1 : i === currentLegIndex ? currentLegFraction : 0;
            return (
              <View
                key={i}
                className="h-2 rounded-full overflow-hidden"
                style={{ flex: weights[i], backgroundColor: "#D4D4D4" }}
              >
                <View
                  className="h-full"
                  style={{
                    width: `${Math.round(fill * 100)}%`,
                    backgroundColor: color,
                    minWidth: i === currentLegIndex ? 4 : 0,
                  }}
                />
              </View>
            );
          })}
        </View>
        <Pressable
          onPress={onNext}
          hitSlop={8}
          accessibilityLabel={isLast ? t("common.finish") : t("nav.next")}
        >
          <Ionicons
            name={isLast ? "checkmark-circle" : "chevron-forward-circle"}
            size={26}
            color={isLast ? "#018959" : "#404040"}
          />
        </Pressable>
      </View>
      <Text className="text-muted text-xs -mt-1">
        {t("nav.stepAuto", { n: currentLegIndex + 1, total: legs.length })}
      </Text>

      {expanded && (
        <ScrollView className="max-h-80" contentContainerClassName="gap-1 pb-2">
          {legs.map((leg, i) => {
            const style = legModeStyle(leg.mode);
            const active = i === currentLegIndex;
            const done = i < currentLegIndex;
            const min = legDurationMin(leg);
            return (
              <Pressable
                key={i}
                onPress={() => onSelectLeg(i)}
                className={`flex-row items-center gap-3 px-3 py-2.5 rounded-xl ${active ? "bg-surface-2" : ""}`}
                style={{ opacity: done ? 0.5 : 1 }}
              >
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${style.color}33` }}
                >
                  <Ionicons name={done ? "checkmark" : style.icon} size={16} color={style.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-ink text-sm font-semibold" numberOfLines={2}>
                    {isWalkLeg(leg) ? t("nav.walkTo", { place: leg.to }) : boardText(leg)}
                  </Text>
                  <Text className="text-muted text-xs" numberOfLines={1}>
                    {[
                      formatClock(leg.depart_at),
                      !isWalkLeg(leg) ? t("nav.getOffLower", { place: leg.to }) : null,
                      leg.distance_m ? formatDistance(leg.distance_m) : null,
                      min ? t("format.minutes", { n: min }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <View className="flex-row gap-2 pt-2">
            <View className="flex-1 bg-surface-2 rounded-xl p-3 gap-0.5">
              <Text className="text-muted text-xs">{t("nav.crowding")}</Text>
              <Text className="text-sm font-bold" style={{ color: crowd?.color ?? "#737373" }}>
                {crowd?.label ?? t("nav.noReports")}
              </Text>
            </View>
            <View className="flex-1 bg-surface-2 rounded-xl p-3 gap-0.5">
              <Text className="text-muted text-xs">{t("nav.reliability")}</Text>
              <Text className="text-ink text-sm font-bold">
                {route.reliability ? `${Math.round(route.reliability.score * 100)}%` : t("nav.notAvailable")}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

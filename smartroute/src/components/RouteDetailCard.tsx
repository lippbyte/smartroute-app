// src/components/RouteDetailCard.tsx
//
// Linimasa perjalanan ala Google Maps: jam di kiri, garis berwarna per moda
// (putus-putus untuk jalan kaki), nama titik naik/turun, arah kendaraan,
// jumlah halte, dan daftar halte yang dilewati (bisa dibuka).
import { Leg, RouteItem } from "@/type";
import {
  boardText,
  formatClock,
  formatDistance,
  isWalkLeg,
  legDurationMin,
  serviceLabel,
  stopCount,
} from "@/utils/navInstructions";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Text from "./Text";
import { legModeStyle } from "./transit/legModes";

interface Props {
  item: RouteItem;
  originName: string;
}

function PlaceRow({
  time,
  name,
  dotColor,
  isEnd,
}: {
  time: string | null;
  name: string;
  dotColor: string;
  isEnd?: boolean;
}) {
  return (
    <View className="flex-row items-center">
      <Text className="w-12 text-muted text-xs">{time ?? ""}</Text>
      <View className="w-6 items-center">
        {isEnd ? (
          <Ionicons name="location" size={16} color="#EF4444" />
        ) : (
          <View
            className="w-3.5 h-3.5 rounded-full bg-surface"
            style={{ borderWidth: 3, borderColor: dotColor }}
          />
        )}
      </View>
      <Text className="flex-1 pl-2 text-ink font-bold text-base" numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

function LegBody({ leg }: { leg: Leg }) {
  const [showStops, setShowStops] = useState(false);
  const style = legModeStyle(leg.mode);
  const walk = isWalkLeg(leg);
  const minutes = legDurationMin(leg);
  const stops = stopCount(leg);

  return (
    <View className="flex-row min-h-[56px]">
      <View className="w-12" />
      {/* Garis moda: solid berwarna untuk transit, titik-titik abu untuk
          jalan kaki — sama seperti Google Maps. */}
      <View className="w-6 items-center">
        {walk ? (
          <View className="flex-1 items-center justify-around py-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} className="w-1 h-1 rounded-full bg-light-3" />
            ))}
          </View>
        ) : (
          <View className="flex-1 w-1.5 rounded-full" style={{ backgroundColor: style.color }} />
        )}
      </View>
      <View className="flex-1 pl-2 py-3 gap-1.5">
        {walk ? (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="walk" size={16} color="#737373" />
            <Text className="text-ink-2 text-sm">
              Jalan kaki
              {minutes ? ` ${minutes} mnt` : ""}
              {leg.distance_m ? ` · ${formatDistance(leg.distance_m)}` : ""}
            </Text>
          </View>
        ) : (
          <>
            <View className="flex-row items-center gap-2 flex-wrap">
              <View
                className="flex-row items-center gap-1 px-2 py-0.5 rounded-md"
                style={{ backgroundColor: `${style.color}33` }}
              >
                <Ionicons name={style.icon} size={13} color={style.color} />
                <Text className="text-xs font-bold" style={{ color: "#0A0A0A" }}>
                  {serviceLabel(leg)}
                </Text>
              </View>
            </View>
            <Text className="text-ink-2 text-sm">{boardText(leg)}</Text>
            {(stops != null || minutes != null) && (
              <Pressable
                onPress={() => setShowStops((s) => !s)}
                disabled={!leg.stops_passed?.length}
                className="flex-row items-center gap-1"
                accessibilityRole="button"
                accessibilityLabel="Tampilkan halte yang dilewati"
              >
                <Text className="text-muted text-xs">
                  {[
                    stops != null ? `${stops} ${style.isRail ? "stasiun" : "halte"}` : null,
                    minutes != null ? `${minutes} mnt` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {!!leg.stops_passed?.length && (
                  <Ionicons
                    name={showStops ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#737373"
                  />
                )}
              </Pressable>
            )}
            {showStops &&
              leg.stops_passed?.map((s, i) => (
                <View key={`${s.name}-${i}`} className="flex-row items-center gap-2">
                  <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                  <Text className="text-muted text-xs">{s.name}</Text>
                </View>
              ))}
          </>
        )}
      </View>
    </View>
  );
}

export default function RouteDetailCard({ item, originName }: Props) {
  const legs = item.legs;
  return (
    <View className="bg-surface border border-line rounded-xl overflow-hidden">
      <View className="p-4">
        {legs.map((leg, index) => {
          const prev = legs[index - 1];
          const style = legModeStyle(leg.mode);
          // Titik transit pakai warna moda leg berikutnya (halte naik).
          const dotColor = isWalkLeg(leg) ? (prev ? legModeStyle(prev.mode).color : "#0A0A0A") : style.color;
          return (
            <View key={index}>
              <PlaceRow
                time={formatClock(leg.depart_at)}
                name={index === 0 ? originName : leg.from}
                dotColor={dotColor}
              />
              <LegBody leg={leg} />
            </View>
          );
        })}
        <PlaceRow
          time={formatClock(legs[legs.length - 1]?.arrive_at)}
          name={legs[legs.length - 1]?.to ?? "Tujuan"}
          dotColor="#EF4444"
          isEnd
        />
      </View>
    </View>
  );
}

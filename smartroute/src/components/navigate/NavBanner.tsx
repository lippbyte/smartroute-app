// Banner instruksi di atas peta, ala Google Maps: satu instruksi besar yang
// sedang berlaku (belokan berikutnya / naik / turun), plus "Kemudian" untuk
// langkah sesudahnya.
import Text from "@/components/Text";
import { legModeStyle } from "@/components/transit/legModes";
import { Leg } from "@/type";
import {
  boardText,
  directionIcon,
  formatClock,
  formatDistance,
  isWalkLeg,
  legDurationMin,
  walkStepText,
} from "@/utils/navInstructions";
import { LegProgress } from "@/utils/navProgress";
import { Ionicons } from "@expo/vector-icons";
import { LayoutChangeEvent, View } from "react-native";

interface Props {
  leg: Leg;
  nextLeg: Leg | null;
  progress: LegProgress;
  isLastLeg: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
}

function instruction(leg: Leg, p: LegProgress, isLastLeg: boolean) {
  const style = legModeStyle(leg.mode);
  if (isWalkLeg(leg)) {
    const step = p.nextStepIndex != null ? leg.walk_steps?.[p.nextStepIndex] : undefined;
    const target = leg.to;
    if (step) {
      return {
        icon: directionIcon(step.direction),
        big: p.distToNextStepM != null && p.nextStepIndex! > 0 ? formatDistance(p.distToNextStepM) : null,
        title: walkStepText(step),
        subtitle: `Jalan kaki menuju ${target} · sisa ${formatDistance(p.remainingM || leg.distance_m || 0)}`,
        color: "#018959",
      };
    }
    return {
      icon: isLastLeg ? "flag" : "walk",
      big: formatDistance(p.remainingM || leg.distance_m || 0),
      title: `Jalan kaki ke ${target}`,
      subtitle: isLastLeg ? "Tujuan ada di ujung jalan ini" : "Lanjutkan sampai titik naik berikutnya",
      color: "#018959",
    };
  }

  const stopWord = style.isRail ? "stasiun" : "halte";
  if (!p.onBoard) {
    const at = formatClock(leg.depart_at);
    return {
      icon: style.icon,
      big: at,
      title: boardText(leg),
      subtitle: `Di ${leg.from}${
        p.stopsRemaining != null ? ` · ${p.stopsRemaining} ${stopWord} sampai ${leg.to}` : ""
      }`,
      color: style.color,
    };
  }
  const arrive = formatClock(leg.arrive_at);
  return {
    icon: "exit-outline",
    big: p.stopsRemaining != null ? `${p.stopsRemaining}` : null,
    bigCaption: p.stopsRemaining != null ? `${stopWord} lagi` : undefined,
    title: `Turun di ${leg.to}`,
    subtitle: `${boardText(leg)}${arrive ? ` · tiba ${arrive}` : ""}`,
    color: style.color,
  };
}

function thenText(next: Leg): string {
  if (isWalkLeg(next)) {
    const min = legDurationMin(next);
    return `Jalan kaki${next.distance_m ? ` ${formatDistance(next.distance_m)}` : ""}${min ? ` (${min} mnt)` : ""} ke ${next.to}`;
  }
  return boardText(next);
}

export default function NavBanner({ leg, nextLeg, progress, isLastLeg, onLayout }: Props) {
  const ins = instruction(leg, progress, isLastLeg);
  const nextStyle = nextLeg ? legModeStyle(nextLeg.mode) : null;

  return (
    <View onLayout={onLayout} className="absolute top-12 left-3 right-3 z-10 gap-1.5">
      <View
        className="rounded-2xl px-4 py-3.5 flex-row items-center gap-3.5 shadow-lg"
        style={{ backgroundColor: ins.color === "#018959" ? "#0B6E4F" : "#1F1F23", borderLeftWidth: 6, borderLeftColor: ins.color }}
      >
        <View className="items-center min-w-[52px]">
          <Ionicons name={ins.icon as keyof typeof Ionicons.glyphMap} size={34} color="#FFFFFF" />
          {ins.big && (
            <Text className="font-bold text-base" style={{ color: "#FFFFFF" }}>
              {ins.big}
            </Text>
          )}
          {"bigCaption" in ins && ins.bigCaption && (
            <Text className="text-[10px]" style={{ color: "#E4E4E7" }}>
              {ins.bigCaption}
            </Text>
          )}
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-bold text-lg leading-6" style={{ color: "#FFFFFF" }} numberOfLines={3}>
            {ins.title}
          </Text>
          <Text className="text-xs" style={{ color: "#D4D4D8" }} numberOfLines={2}>
            {ins.subtitle}
          </Text>
        </View>
      </View>

      {nextLeg && nextStyle && (
        <View className="self-start flex-row items-center gap-1.5 bg-surface rounded-xl px-3 py-1.5 border border-line max-w-full">
          <Text className="text-xs font-semibold" style={{ color: "#737373" }}>
            Kemudian
          </Text>
          <Ionicons name={nextStyle.icon} size={14} color={nextStyle.color} />
          <Text className="text-xs flex-shrink" style={{ color: "#404040" }} numberOfLines={1}>
            {thenText(nextLeg)}
          </Text>
        </View>
      )}
    </View>
  );
}

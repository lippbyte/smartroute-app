// src/components/navigate/SimpleNavView.tsx
//
// Hari 3 Task 2: "Mode sederhana" navigasi (diusulkan untuk profil
// kognitif/neurodivergen): SATU langkah per layar, kalimat lugas, tanpa
// peta dan tanpa animasi. Pindah langkah otomatis lewat GPS tetap jalan
// (logikanya di navigate.tsx); tombol besar untuk maju/mundur manual.
import PrimaryButton from "@/components/form/PrimaryButton";
import Text from "@/components/Text";
import { legModeStyle } from "@/components/transit/legModes";
import type { Leg } from "@/type";
import { isWalkLeg } from "@/utils/navInstructions";
import type { LegProgress } from "@/utils/navProgress";
import { plainStep } from "@/utils/simpleSteps";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, View } from "react-native";

interface Props {
  legs: Leg[];
  currentLegIndex: number;
  progress: LegProgress;
  remainingMin: number;
  /** Hari 4 Task 1: pesan satu kalimat bila GPS ditolak/gagal. */
  notice?: string | null;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}

export default function SimpleNavView({ legs, currentLegIndex, progress, remainingMin, notice, onPrev, onNext, onExit }: Props) {
  const leg = legs[currentLegIndex];
  const isLast = currentLegIndex === legs.length - 1;
  const step = plainStep(leg, isLast, { onBoard: progress.onBoard, stopsRemaining: progress.stopsRemaining });
  const style = legModeStyle(leg.mode);

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 64, gap: 20 }}>
        <Text className="text-ink-2 text-base" weight="semibold" accessibilityLiveRegion="polite">
          Langkah {currentLegIndex + 1} dari {legs.length} · sisa sekitar {remainingMin} menit
        </Text>
        {notice ? (
          <Text className="text-ink text-base" accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}

        <View className="flex-1 justify-center gap-5" accessible accessibilityLabel={`${step.title}. ${step.detail}`}>
          <View
            className="w-20 h-20 rounded-2xl items-center justify-center"
            style={{ backgroundColor: isWalkLeg(leg) ? "#D1FAE5" : `${style.color}26` }}
          >
            <Ionicons name={style.icon} size={44} color={isWalkLeg(leg) ? "#065F46" : style.color === "#FFFFFF" ? "#404040" : style.color} />
          </View>
          <Text className="text-ink text-3xl" weight="bold" style={{ lineHeight: 38 }}>
            {step.title}
          </Text>
          <Text className="text-ink text-xl" style={{ lineHeight: 28 }}>
            {step.detail}
          </Text>
        </View>

        <View className="gap-3">
          <PrimaryButton label={isLast ? "Saya sudah sampai" : "Langkah berikutnya"} onPress={onNext} />
          {currentLegIndex > 0 && <PrimaryButton label="Langkah sebelumnya" variant="outline" onPress={onPrev} />}
          <PrimaryButton label="Keluar dari navigasi" variant="outline" onPress={onExit} />
        </View>
      </ScrollView>
    </View>
  );
}

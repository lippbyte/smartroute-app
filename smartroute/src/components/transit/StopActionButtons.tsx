// src/components/transit/StopActionButtons.tsx
//
// "Jalan ke sini" + "Berangkat dari sini" — label ini juga disebut persis
// oleh Asisten AI di jawabannya (lihat SYSTEM_PROMPT_HEADER di backend
// services/assistant.ts), jadi jangan diganti sepihak.
import Text from "@/components/Text";
import { Coordinate } from "@/utils/geocode";
import { openDepartFromStop, openWalkToStop, StopTarget } from "@/utils/stopActions";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

export default function StopActionButtons({
  stop,
  userLocation,
}: {
  stop: StopTarget;
  /** null = GPS tidak tersedia; tombol "Jalan ke sini" dinonaktifkan. */
  userLocation: Coordinate | null;
}) {
  const router = useRouter();
  const canWalk = userLocation !== null;

  return (
    <View className="flex-row gap-2">
      <Pressable
        onPress={() => userLocation && openWalkToStop(router, userLocation, stop)}
        disabled={!canWalk}
        accessibilityRole="button"
        accessibilityLabel={`Jalan ke ${stop.name}`}
        className="flex-1 flex-row items-center justify-center gap-1.5 bg-[#018959] py-2.5 rounded-xl active:opacity-80"
        style={{ opacity: canWalk ? 1 : 0.5 }}
      >
        <Ionicons name="walk" size={15} color="#FFFFFF" />
        <Text className="text-white font-bold text-xs">Jalan ke sini</Text>
      </Pressable>
      <Pressable
        onPress={() => openDepartFromStop(router, stop)}
        accessibilityRole="button"
        accessibilityLabel={`Berangkat dari ${stop.name}`}
        className="flex-1 flex-row items-center justify-center gap-1.5 bg-surface-2 border border-line py-2.5 rounded-xl active:opacity-80"
      >
        <Ionicons name="navigate" size={15} color="#0A0A0A" />
        <Text className="text-ink font-bold text-xs">Berangkat dari sini</Text>
      </Pressable>
    </View>
  );
}

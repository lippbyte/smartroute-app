// src/components/BadgeInfoSheet.tsx
//
// Hari 2 Task 3: penjelasan saat lencana kartu rute diketuk. Selalu memuat
// "Heuristik sederhana, bukan saran medis." Modal dengan teks (bukan
// Alert.alert — tombol Alert tidak jalan di web).
import PrimaryButton from "@/components/form/PrimaryButton";
import Text from "@/components/Text";
import { badgeExplanation, type RouteBadge } from "@/utils/routeBadges";
import { useRouter } from "expo-router";
import { Modal, Pressable, View } from "react-native";

export default function BadgeInfoSheet({ badge, onClose }: { badge: RouteBadge | null; onClose: () => void }) {
  const router = useRouter();
  return (
    <Modal visible={!!badge} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} accessibilityLabel="Tutup penjelasan">
        <Pressable onPress={() => {}} className="bg-surface rounded-3xl p-5 gap-3">
          {badge && (
            <>
              <Text className="text-ink text-xl" weight="bold" accessibilityRole="header">
                {badge.label}
              </Text>
              <Text className="text-ink-2 text-[15px]" style={{ lineHeight: 22 }}>
                {badgeExplanation(badge.kind)}
              </Text>
              <Text className="text-ink-2 text-sm" weight="semibold">
                Heuristik sederhana, bukan saran medis.
              </Text>
              <View className="gap-2 pt-1">
                <PrimaryButton
                  label="Tentang angka ini"
                  variant="outline"
                  onPress={() => {
                    onClose();
                    router.push("/co2-info");
                  }}
                />
                <PrimaryButton label="Tutup" onPress={onClose} />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Overlay "Tentang & Masukan" (ikon pesan di halaman Akun): info pengembang,
// sumber data, dan jalur mengirim masukan.
//
// Kartu melayang di atas halaman Akun, bukan halaman baru: latar hanya
// meredup (fade di tempat) dan kartu muncul dengan fade + skala. Dulu
// memakai animationType "slide" bawaan Modal, yang menggeser SELURUH layar
// termasuk latar gelapnya dari bawah — terasa seperti membuka halaman baru.
import Text from "@/components/Text";
import { DATA_SOURCES, DEVELOPER_INFO } from "@/constants/developerInfo";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const OPEN_MS = 240;
const CLOSE_MS = 180;

export default function DeveloperInfoSheet({ visible, onClose }: Props) {
  const version = Constants.expoConfig?.version ?? "-";
  const { teamName, event, members, feedbackEmail } = DEVELOPER_INFO;
  const progress = useRef(new Animated.Value(0)).current;
  // Modal tetap terpasang sampai animasi tutup selesai.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* Style langsung pada Animated.View: NativeWind tidak menerapkan
          className ke Animated.View bawaan RN di web. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: progress }]} />

      <Pressable style={styles.center} onPress={onClose} accessibilityLabel="Tutup">
        <Animated.View
          style={[
            styles.card,
            {
              opacity: progress,
              transform: [
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            },
          ]}
        >
          {/* Menahan tap di dalam kartu supaya tidak menutup overlay. */}
          <Pressable onPress={() => {}} style={{ flexShrink: 1 }}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="chatbox-ellipses-outline" size={20} color="#018959" />
                <Text className="text-ink font-bold text-lg">Tentang & Masukan</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Tutup">
                <Ionicons name="close" size={22} color="#737373" />
              </Pressable>
            </View>

            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="bg-surface-2 rounded-2xl p-4 gap-1">
                <Text className="text-muted text-xs">Dikembangkan oleh</Text>
                <Text className="text-ink font-bold text-base">{teamName}</Text>
                <Text className="text-muted text-xs">
                  {event} · versi {version}
                </Text>
                {members.map((m) => (
                  <Text key={m.name} className="text-ink-2 text-sm">
                    {m.name} — {m.role}
                  </Text>
                ))}
              </View>

              <View className="bg-surface-2 rounded-2xl p-4 gap-2">
                <Text className="text-ink font-semibold text-sm">Sumber data</Text>
                {DATA_SOURCES.map((s) => (
                  <View key={s} className="flex-row items-center gap-2">
                    <Ionicons name="checkmark-circle" size={14} color="#018959" />
                    <Text className="text-ink-2 text-xs flex-1">{s}</Text>
                  </View>
                ))}
              </View>

              <View className="bg-surface-2 rounded-2xl p-4 gap-2">
                <Text className="text-ink font-semibold text-sm">Punya masukan?</Text>
                <Text className="text-muted text-xs">
                  Ceritakan rute yang kurang tepat, tarif yang berbeda, atau
                  fitur yang kamu butuhkan — masukanmu membantu kami
                  memperbaiki SmartRoute AI.
                </Text>
                {feedbackEmail ? (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(
                        `mailto:${feedbackEmail}?subject=${encodeURIComponent(`Masukan SmartRoute AI v${version}`)}`,
                      )
                    }
                    className="mt-1 py-3 rounded-xl items-center bg-[#018959] flex-row justify-center gap-2"
                  >
                    <Ionicons name="mail-outline" size={16} color="#FFFFFF" />
                    <Text className="font-bold text-sm" style={{ color: "#FFFFFF" }}>
                      Kirim Masukan
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: "rgba(0,0,0,0.55)" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D4D4D4",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
});

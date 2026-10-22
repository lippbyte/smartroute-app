// Menu samping (tombol burger di halaman Akun): pintasan ke semua fitur app.
import Text from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";

const PANEL_WIDTH = 290;

const ITEMS: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; href: Href }> = [
  { label: "Beranda", icon: "home-outline", href: "/" },
  { label: "Hasil Rute", icon: "git-branch-outline", href: "/route" },
  { label: "Riwayat Perjalanan", icon: "time-outline", href: "/history" },
  { label: "Peta Kepadatan", icon: "map-outline", href: "/crowd-map" },
  { label: "Halte Terdekat", icon: "navigate-outline", href: "/nearby-stops" },
  { label: "Semua Halte", icon: "location-outline", href: "/all-stops-map" },
  { label: "TOTO · Asisten AI", icon: "chatbubble-ellipses-outline", href: "/assistant" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SideMenu({ visible, onClose }: Props) {
  const router = useRouter();
  const progress = useRef(new Animated.Value(0)).current;
  // Modal tetap terpasang selama animasi keluar berjalan.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 280 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* Style langsung, bukan className: NativeWind tidak menerapkan class
          ke Animated.View bawaan RN (di web panel jadi transparan). */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)", opacity: progress }]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Tutup menu" />
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          backgroundColor: "#F8FAFC",
          borderRightWidth: 1,
          borderRightColor: "#D4D4D4",
          paddingTop: 56,
          paddingHorizontal: 16,
          gap: 4,
          width: PANEL_WIDTH,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-PANEL_WIDTH, 0] }) },
          ],
        }}
      >
        <View className="flex-row items-center justify-between px-2 pb-5">
          <Text className="text-ink font-bold text-xl">SmartRoute AI</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Tutup menu">
            <Ionicons name="close" size={24} color="#737373" />
          </Pressable>
        </View>
        {ITEMS.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => go(item.href)}
            className="flex-row items-center gap-3.5 px-3 py-3.5 rounded-xl active:bg-surface-2"
            accessibilityRole="button"
          >
            <Ionicons name={item.icon} size={20} color="#404040" />
            <Text className="text-ink text-base font-semibold">{item.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Text from "./Text";

// ─── Tipe Data ────────────────────────────────────────────────
interface PreferenceItemProps {
  label: string;
  value: string;
  onPress?: () => void;
  showBorder?: boolean;
}

interface PreferenceOption {
  id: string;
  label: string;
  value: string;
  options: string[];
}

// ─── Baris Preferensi ─────────────────────────────────────────
function PreferenceItem({
  label,
  value,
  onPress,
  showBorder = true,
}: PreferenceItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row justify-between items-center py-3.5 active:opacity-60 ${
        showBorder ? "border-b border-line" : ""
      }`}
    >
      <Text className="text-ink-2 text-sm font-medium">{label}</Text>
      <View className="flex-row items-center gap-1.5 flex-1 justify-end ml-4">
        <Text
          className="text-ink text-sm font-semibold text-right"
          numberOfLines={1}
        >
          {value}
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#737373" />
      </View>
    </Pressable>
  );
}

// ─── Modal Pilihan ────────────────────────────────────────────
interface OptionModalProps {
  visible: boolean;
  title: string;
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

const OPEN_MS = 220;
const CLOSE_MS = 170;

// Animasi buka/tutup sendiri (bukan animationType bawaan Modal): isi kartu
// "dibekukan" (snapshot) selama animasi tutup berjalan. Sebelumnya pemanggil
// langsung mengosongkan judul & pilihan saat menutup, sehingga selama fade
// keluar kartu putih mengecil jadi kartu kosong — terlihat seperti dua modal.
function OptionModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: OptionModalProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [snapshot, setSnapshot] = useState({ title, options, selectedValue });

  useEffect(() => {
    if (visible) {
      setSnapshot({ title, options, selectedValue });
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
    // Snapshot hanya diambil saat modal dibuka — sengaja tidak mengikuti
    // perubahan props selama animasi tutup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const choose = (option: string) => {
    // Tanda centang pindah seketika ke pilihan baru, lalu modal menutup.
    setSnapshot((s) => ({ ...s, selectedValue: option }));
    onSelect(option);
    onClose();
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* Style langsung pada Animated.View: NativeWind tidak menerapkan
          className ke Animated.View bawaan RN di web. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </Animated.View>

      <Pressable
        className="flex-1 justify-center items-center px-6"
        onPress={onClose}
        accessibilityLabel="Tutup pilihan"
      >
        <Animated.View
          style={[
            styles.card,
            styles.shadow,
            {
              opacity: progress,
              transform: [
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            },
          ]}
        >
          {/* Pressable kosong menahan tap di dalam kartu supaya tidak
              diteruskan ke latar (yang menutup modal). */}
          <Pressable onPress={() => {}}>
            <Text className="text-base font-bold text-slate-900 text-center pt-5 pb-3.5">
              {snapshot.title}
            </Text>

            <View className="h-px bg-slate-100 mx-4" />

            {snapshot.options.map((option, index) => {
              const isSelected = option === snapshot.selectedValue;
              const isLast = index === snapshot.options.length - 1;

              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => choose(option)}
                  className={`flex-row justify-between items-center px-6 py-4 ${
                    !isLast ? "border-b border-slate-100" : ""
                  }`}
                >
                  <Text
                    className="text-base"
                    style={{
                      color: isSelected ? "#3B82F6" : "#334155",
                      fontWeight: isSelected ? "700" : "600",
                    }}
                  >
                    {option}
                  </Text>

                  {isSelected && <Ionicons name="checkmark" size={18} color="#3B82F6" />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={onClose}
              className="items-center py-4 mt-1 border-t border-slate-100"
            >
              <Text className="text-base font-semibold text-red-500">Batal</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── Komponen Utama ───────────────────────────────────────────
export default function PreferenceCard() {
  const [modalVisible, setModalVisible] = useState(false);
  const [activePreference, setActivePreference] =
    useState<PreferenceOption | null>(null);

  const [preferences, setPreferences] = useState<PreferenceOption[]>([
    {
      id: "1",
      label: "Prioritas Utama",
      value: "Hemat",
      options: ["Hemat", "Cepat", "Nyaman"],
    },
    {
      id: "2",
      label: "Maks. Transit",
      value: "1x",
      options: ["Tanpa Transit", "1x", "2x", "Tidak Batas"],
    },
    {
      id: "3",
      label: "Moda Favorit",
      value: "MRT",
      options: ["MRT", "TransJakarta", "KRL", "Angkot", "Semua"],
    },
    {
      id: "4",
      label: "Maks. Jalan Kaki",
      value: "10 Menit",
      options: ["5 Menit", "10 Menit", "15 Menit", "20 Menit"],
    },
  ]);

  const handlePress = (item: PreferenceOption) => {
    setActivePreference(item);
    setModalVisible(true);
  };

  const handleSelect = (selectedValue: string) => {
    if (!activePreference) return;
    setPreferences((prev) =>
      prev.map((p) =>
        p.id === activePreference.id ? { ...p, value: selectedValue } : p,
      ),
    );
  };

  return (
    <View className="bg-surface w-full px-5 py-4 rounded-2xl border border-line">
      <Text className="text-ink font-bold text-lg mb-1">
        Preferensi
      </Text>

      <View className="w-full">
        {preferences.map((item, index) => (
          <PreferenceItem
            key={item.id}
            label={item.label}
            value={item.value}
            showBorder={index !== preferences.length - 1}
            onPress={() => handlePress(item)}
          />
        ))}
      </View>

      <OptionModal
        visible={modalVisible}
        title={activePreference?.label ?? ""}
        options={activePreference?.options ?? []}
        selectedValue={activePreference?.value ?? ""}
        onSelect={handleSelect}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// ─── StyleSheet MINIMAL — hanya untuk yang tidak bisa NativeWind ──
const styles = StyleSheet.create({
  dim: { backgroundColor: "rgba(0,0,0,0.4)" },
  card: {
    width: "100%",
    maxWidth: 300,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
  },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
});

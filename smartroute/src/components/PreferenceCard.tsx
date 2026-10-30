// Kartu Preferensi di Profil. Hari 1 Task 3: data asli dari akun (dulu
// opsi statis "Hemat / Maks. Transit / Moda Favorit" yang tidak tersimpan
// di mana pun). Label & catatan sama dengan onboarding
// (constants/preferenceLabels.ts). Mengubah prioritas TIDAK mengubah chip
// default di layar hasil — tetap "Semua" (keputusan 2a).
import { ToggleChip } from "@/components/form/ChoiceControls";
import {
  AVOID_MODE_OPTIONS,
  labelOf,
  PRIORITY_NOTE,
  PRIORITY_OPTIONS,
  STORED_ONLY_NOTE,
  WALK_LIMIT_OPTIONS,
} from "@/constants/preferenceLabels";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import * as authService from "@/services/authService";
import type { AvoidableMode, Priority, UserPreferences, WalkLimit } from "@/services/authService";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

const NONE_LABEL = "Belum dipilih";

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
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Ketuk untuk mengubah.`}
      className={`flex-row justify-between items-center py-3.5 active:opacity-60 ${
        showBorder ? "border-b border-line" : ""
      }`}
      style={{ minHeight: 48 }}
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
type ModalKind = "priority" | "walk";

const MODAL_CONFIG: Record<ModalKind, { title: string; options: { value: string; label: string }[] }> = {
  priority: { title: "Prioritas utama", options: PRIORITY_OPTIONS },
  walk: { title: "Batas jalan kaki", options: WALK_LIMIT_OPTIONS },
};

export default function PreferenceCard() {
  const { status, user, token, replaceUser } = useAuth();
  const [modal, setModal] = useState<ModalKind | null>(null);
  // Judul/pilihan modal dipertahankan selama animasi tutup (lihat OptionModal).
  const [lastModal, setLastModal] = useState<ModalKind>("priority");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "signedIn" || !user || !token) {
    return (
      <View className="bg-surface w-full px-5 py-4 rounded-2xl border border-line gap-1">
        <Text className="text-ink font-bold text-lg">Preferensi</Text>
        <Text className="text-ink-2 text-sm">
          Masuk untuk menyimpan prioritas perjalanan, batas jalan kaki, dan moda yang ingin dihindari.
        </Text>
      </View>
    );
  }

  const prefs = user.preferences;
  const current: Required<UserPreferences> = {
    priority: prefs.priority ?? null,
    walk_limit: prefs.walk_limit ?? null,
    avoid_modes: prefs.avoid_modes ?? [],
  };

  const save = async (patch: Partial<UserPreferences>) => {
    setSaving(true);
    setError(null);
    try {
      replaceUser(await authService.updatePreferences(token, { ...current, ...patch }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan preferensi. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const openModal = (kind: ModalKind) => {
    setLastModal(kind);
    setModal(kind);
  };

  const config = MODAL_CONFIG[lastModal];
  const selectedLabel =
    (lastModal === "priority" ? labelOf(PRIORITY_OPTIONS, current.priority) : labelOf(WALK_LIMIT_OPTIONS, current.walk_limit)) ??
    NONE_LABEL;

  const handleSelect = (label: string) => {
    const value = config.options.find((o) => o.label === label)?.value ?? null;
    if (lastModal === "priority") void save({ priority: value as Priority | null });
    else void save({ walk_limit: value as WalkLimit | null });
  };

  const toggleMode = (m: AvoidableMode) =>
    void save({
      avoid_modes: current.avoid_modes.includes(m) ? current.avoid_modes.filter((x) => x !== m) : [...current.avoid_modes, m],
    });

  return (
    <View className="bg-surface w-full px-5 py-4 rounded-2xl border border-line">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-ink font-bold text-lg">Preferensi</Text>
        {saving && <ActivityIndicator size="small" color="#0F3FC1" accessibilityLabel="Menyimpan preferensi" />}
      </View>

      <View className="w-full">
        <PreferenceItem
          label="Prioritas utama"
          value={labelOf(PRIORITY_OPTIONS, current.priority) ?? NONE_LABEL}
          onPress={() => openModal("priority")}
        />
        <Text className="text-ink-2 text-xs pt-2 pb-1">{PRIORITY_NOTE}</Text>
        <PreferenceItem
          label="Batas jalan kaki"
          value={labelOf(WALK_LIMIT_OPTIONS, current.walk_limit) ?? NONE_LABEL}
          onPress={() => openModal("walk")}
        />
        <View className="py-3.5 gap-2.5">
          <Text className="text-ink-2 text-sm font-medium">Moda yang ingin dihindari</Text>
          <View className="flex-row flex-wrap gap-2">
            {AVOID_MODE_OPTIONS.map((o) => (
              <ToggleChip
                key={o.value}
                label={o.label}
                selected={current.avoid_modes.includes(o.value)}
                onPress={() => toggleMode(o.value)}
              />
            ))}
          </View>
        </View>
        <Text className="text-ink-2 text-xs">{STORED_ONLY_NOTE}</Text>
      </View>

      {error && (
        <Text className="text-sm mt-2" style={{ color: "#B91C1C" }} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <OptionModal
        visible={modal !== null}
        title={config.title}
        options={[...config.options.map((o) => o.label), NONE_LABEL]}
        selectedValue={selectedLabel}
        onSelect={handleSelect}
        onClose={() => setModal(null)}
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

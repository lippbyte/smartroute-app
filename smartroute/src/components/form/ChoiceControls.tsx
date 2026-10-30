// src/components/form/ChoiceControls.tsx
//
// Hari 1 Task 3: kontrol pilihan untuk onboarding & Profil.
// - OptionCard: pilih satu (radio) dengan judul + deskripsi.
// - ToggleChip: pilih beberapa (moda yang dihindari).
// - CheckboxRow: centang (kebutuhan aksesibilitas, persetujuan).
// Status terpilih tidak hanya lewat warna: ada ikon centang/radio juga,
// dan accessibilityState untuk pembaca layar. Target sentuh >= 48 px.
import Text from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

const BLUE = "#0F3FC1";

export function OptionCard({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      className="flex-row items-center gap-3 rounded-2xl px-4 py-3.5 active:opacity-80"
      style={{
        minHeight: 56,
        backgroundColor: selected ? "#EEF2FF" : "#FFFFFF",
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? BLUE : "#737373",
      }}
    >
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? BLUE : "#404040"} />
      <View className="flex-1 gap-0.5">
        <Text className="text-ink text-base" weight="bold">
          {label}
        </Text>
        {description && <Text className="text-ink-2 text-sm">{description}</Text>}
      </View>
    </Pressable>
  );
}

export function ToggleChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      className="flex-row items-center gap-1.5 rounded-full px-4 active:opacity-80"
      style={{
        minHeight: 48,
        backgroundColor: selected ? BLUE : "#FFFFFF",
        borderWidth: 1.5,
        borderColor: selected ? BLUE : "#737373",
      }}
    >
      {selected && <Ionicons name="close-circle" size={18} color="#FFFFFF" />}
      <Text className="text-[15px]" weight="semibold" style={{ color: selected ? "#FFFFFF" : "#0A0A0A" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CheckboxRow({
  label,
  checked,
  onPress,
  emphasis,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  /** Untuk kotak persetujuan: latar sedikit berbeda supaya menonjol. */
  emphasis?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      className="flex-row items-start gap-3 rounded-xl px-3 py-3 active:opacity-80"
      style={{
        minHeight: 48,
        backgroundColor: emphasis ? "#F4F4F0" : "transparent",
        borderWidth: emphasis ? 1 : 0,
        borderColor: "#D4D4D4",
      }}
    >
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={checked ? BLUE : "#404040"} />
      <Text className="flex-1 text-ink text-[15px]" style={{ lineHeight: 21 }}>
        {label}
      </Text>
    </Pressable>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import Text from "./Text";

interface QuickLocationCardProps {
  title: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  onLongPress?: () => void;
  /**
   * Perluasan Task App-21 (diminta user langsung): nama lokasi yang sudah
   * disimpan user untuk slot ini (mis. "Jl. Sudirman Kav. 52-53") —
   * undefined/null berarti belum diisi. Baris kedua kecil ini yang
   * membedakan kartu "sudah diisi" dari yang masih dekoratif tanpa perlu
   * elemen visual tambahan (badge, dsb).
   */
  savedLabel?: string | null;
}

export default function QuickLocationCard({
  title = "Kantor",
  iconName = "briefcase-sharp",
  onPress,
  onLongPress,
  savedLabel,
}: QuickLocationCardProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="bg-surface flex-1 rounded-2xl items-center justify-center p-5 shadow-card active:opacity-70"
    >
      <Ionicons
        name={iconName}
        size={24}
        // Ikon lebih redup kalau belum diisi — sinyal visual halus "tap
        // untuk atur", tanpa perlu badge/teks tambahan yang mencolok.
        color={savedLabel ? "#0F3FC1" : "#737373"}
      />
      <Text
        className="text-ink text-md font-semibold mt-2 text-center"
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        className="text-muted text-[10px] text-center mt-0.5"
        numberOfLines={1}
      >
        {savedLabel ?? "Tap untuk atur"}
      </Text>
    </Pressable>
  );
}

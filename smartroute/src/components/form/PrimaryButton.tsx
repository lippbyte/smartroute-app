// src/components/form/PrimaryButton.tsx
//
// Hari 1: tombol utama/sekunder form. Tinggi >= 52 (target sentuh lega),
// teks putih di #0F3FC1 ~8.6:1. Saat `loading`, tombol non-aktif supaya
// tidak terkirim dua kali.
import Text from "@/components/Text";
import { ActivityIndicator, Pressable } from "react-native";

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost-light";
  accessibilityHint?: string;
}

export default function PrimaryButton({ label, onPress, loading, disabled, variant = "primary", accessibilityHint }: Props) {
  const inactive = disabled || loading;
  const styles = {
    primary: { bg: inactive ? "#6B7FB8" : "#0F3FC1", border: "transparent", text: "#FFFFFF", spinner: "#FFFFFF" },
    outline: { bg: "#FFFFFF", border: "#0F3FC1", text: "#0F3FC1", spinner: "#0F3FC1" },
    // Di atas latar gelap (di luar kartu): garis & teks putih.
    "ghost-light": { bg: "rgba(255,255,255,0.08)", border: "#FFFFFF", text: "#FFFFFF", spinner: "#FFFFFF" },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      className="rounded-2xl items-center justify-center flex-row gap-2 active:opacity-80"
      style={{
        minHeight: 52,
        paddingHorizontal: 20,
        backgroundColor: styles.bg,
        borderWidth: variant === "primary" ? 0 : 1.5,
        borderColor: styles.border,
      }}
    >
      {loading && <ActivityIndicator size="small" color={styles.spinner} />}
      <Text className="text-base" weight="bold" style={{ color: styles.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

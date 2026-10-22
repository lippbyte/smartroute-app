// components/Text.tsx
//
// Satu-satunya font app: Plus Jakarta Sans versi VARIABLE (satu file,
// semua ketebalan) — dimuat di app/_layout.tsx dengan nama keluarga
// "Plus-Jakarta-Sans". Ketebalan diatur lewat fontWeight di atas keluarga
// yang sama itu.
//
// Dulu komponen ini memetakan tebal ke keluarga "Plus-Jakarta-Sans-Bold",
// "-SemiBold", "-Medium" — yang TIDAK PERNAH dimuat. Setiap teks yang
// tebalnya diatur lewat `style` (bukan className) jatuh ke font cadangan:
// serif (Times) di web, Roboto di Android. Terlihat jelas di pilihan modal
// Preferensi (dilaporkan user 23 Sep 2026).
import { Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native";

const FONT_FAMILY = "Plus-Jakarta-Sans";

const WEIGHT: Record<string, TextStyle["fontWeight"]> = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

interface TextProps extends RNTextProps {
  weight?: keyof typeof WEIGHT;
}

export default function Text({ weight, style, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        { fontFamily: FONT_FAMILY },
        weight ? { fontWeight: WEIGHT[weight] } : null,
        style,
      ]}
    />
  );
}

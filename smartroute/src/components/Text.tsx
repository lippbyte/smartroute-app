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
//
// Hari 3 Task 2: "Tampilan mudah dibaca" (pengaturan bantuan, diusulkan
// untuk profil low vision). Komponen ini didaftarkan ke cssInterop
// NativeWind, jadi className SUDAH menjadi `style` saat sampai di sini —
// ukuran huruf & warna teks sekunder bisa diskalakan di satu tempat untuk
// semua layar (utils/assistiveSettings.ts). Saat pengaturan mati, gaya yang
// diteruskan sama persis seperti sebelumnya.
import { useAssistive } from "@/context/AssistiveSettingsContext";
import { easyReadStyle } from "@/utils/assistiveSettings";
import { cssInterop } from "nativewind";
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from "react-native";

const FONT_FAMILY = "Plus-Jakarta-Sans";

const WEIGHT: Record<string, TextStyle["fontWeight"]> = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

interface TextProps extends RNTextProps {
  weight?: keyof typeof WEIGHT;
  className?: string;
}

function Text({ weight, style, ...props }: TextProps) {
  const { settings } = useAssistive();
  const base = [{ fontFamily: FONT_FAMILY }, weight ? { fontWeight: WEIGHT[weight] } : null, style];
  return <RNText {...props} style={settings.easyRead.on ? easyReadStyle(StyleSheet.flatten(base) ?? {}) : base} />;
}

cssInterop(Text, { className: "style" });

export default Text;

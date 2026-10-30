// src/components/SimulationBanner.tsx
//
// Hari 3 Task 3: label wajib di SETIAP layar/modal Trip Pass, saldo, dan
// top-up. Pembayaran/NFC/saldo di SmartRoute adalah SIMULASI.
import Text from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

export const SIMULATION_TEXT = "Simulasi — tidak terhubung ke bank atau kartu asli";

export default function SimulationBanner() {
  return (
    <View
      className="flex-row items-center gap-2 rounded-xl px-3 py-2.5"
      style={{ backgroundColor: "#FEF3C7", borderWidth: 1.5, borderColor: "#B45309" }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={SIMULATION_TEXT}
    >
      <Ionicons name="flask-outline" size={18} color="#78350F" />
      <Text className="flex-1 text-sm" weight="bold" style={{ color: "#78350F" }}>
        {SIMULATION_TEXT}
      </Text>
    </View>
  );
}

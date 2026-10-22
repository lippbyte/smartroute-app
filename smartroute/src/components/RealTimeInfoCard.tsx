// Task App-21: NAMA FILE/KOMPONEN INI MENYESATKAN — isinya statis, BUKAN
// data real-time. Sudah dikonfirmasi tidak ada sumber data real-time yang
// bisa dipakai untuk info lalu lintas KRL/TransJakarta (GAPEKA & sumber
// lain sudah dicek, tidak cocok — batasan eksplisit task). Teks & ikon di
// bawah sengaja dibuat jelas "info umum/ilustratif", BUKAN status langsung
// saat ini — sebelumnya "beroperasi normal pagi ini" terasa seperti status
// yang baru saja diperbarui, padahal cuma kalimat tetap yang sama setiap
// kali app dibuka jam berapa pun.
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import Text from "./Text";

const RealTimeInfoCard = () => {
  return (
    <View className="w-full bg-surface rounded-2xl p-4 flex-row items-center gap-3">
      <View className="bg-brand-blue/10 p-2.5 rounded-xl">
        {/* "information-circle" (netral) dipilih ganti "warning" (segitiga
            siaga) — ikon lama sendiri turut menyiratkan "ada status
            terkini yang perlu diperhatikan", padahal ini cuma info umum. */}
        <Ionicons name="information-circle-outline" size={30} color="#0F3FC1" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-ink font-bold text-md">Info Umum</Text>
        <Text className="text-muted text-sm">
          Gambaran umum, bukan status langsung: KRL & TransJakarta biasanya
          lancar di jam-jam awal.
        </Text>
      </View>
    </View>
  );
};

export default RealTimeInfoCard;

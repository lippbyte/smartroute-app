import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import Text from "./Text";

export default function AccountCard() {
  return (
    <View className="flex-row items-center gap-4 bg-surface border border-line w-full px-4 py-4 rounded-2xl">
      <View
        className="items-center justify-center"
        style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,135,90,0.2)" }}
      >
        <Ionicons name="person" size={28} color="#018959" />
      </View>
      <View className="gap-1">
        <Text className="text-muted text-sm">Tipe Perjalananmu</Text>
        <Text className="text-ink font-bold text-md">Hemat & Nyaman</Text>
      </View>
    </View>
  );
}

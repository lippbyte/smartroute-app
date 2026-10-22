import { Feather } from "@expo/vector-icons";
import { View } from "react-native";
import Text from "./Text";

const publicPoints = ["Lebih cepat", "Lebih lancar", "Lebih murah"];
const privatePoints = ["Lebih lambat", "Lebih macet", "Lebih mahal"];

function IconRow({ label, positive }: { label: string; positive: boolean }) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        className={`w-4 h-4 rounded-full items-center justify-center ${
          positive ? "bg-primary-emerald" : "bg-accent-orange"
        }`}
      >
        <Feather name={positive ? "check" : "x"} size={10} color="white" />
      </View>
      <Text className="text-ink/80 text-sm">{label}</Text>
    </View>
  );
}

export default function ComparisonCard() {
  return (
    <View className="bg-surface rounded-2xl p-5 shadow-sm border border-line">
      {/* Header */}
      <View className="flex-row items-center mb-5">
        <View className="flex-1 flex-row items-center gap-2.5">
          <View className="w-9 h-9 rounded-full bg-primary-emerald/15 items-center justify-center">
            <Feather name="navigation" size={16} color="#10B981" />
          </View>
          <Text className="text-ink text-sm flex-1">Transportasi Umum</Text>
        </View>

        <View className="w-8 h-8 rounded-full bg-surface-2 items-center justify-center mx-2">
          <Text className="text-ink/40 text-[10px]">vs</Text>
        </View>

        <View className="flex-1 flex-row-reverse items-center gap-2.5">
          <View className="w-9 h-9 rounded-full bg-accent-orange/15 items-center justify-center">
            <Feather name="truck" size={16} color="#F97316" />
          </View>
          <Text className="text-ink text-sm flex-1 text-right">
            Kendaraan Pribadi
          </Text>
        </View>
      </View>

      {/* Body */}
      <View className="flex-row">
        <View className="flex-1 gap-3">
          {publicPoints.map((point) => (
            <IconRow key={point} label={point} positive />
          ))}
        </View>

        <View className="w-px bg-line mx-4" />

        <View className="flex-1 gap-3 items-end">
          {privatePoints.map((point) => (
            <View key={point} className="flex-row-reverse">
              <IconRow label={point} positive={false} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

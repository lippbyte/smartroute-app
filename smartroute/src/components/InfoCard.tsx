import { View } from "react-native";
import Text from "./Text";

type InfoProps = {
  title: string;
  desc: string;
};

export default function InfoCard({ title, desc }: InfoProps) {
  return (
    <View className="bg-surface px-4 py-4 rounded-xl justify-center items-center flex-1 gap-2 border border-line">
      <Text className="text-ink font-bold text-xl text-center">
        {title}
      </Text>
      <Text className="text-ink-2 text-sm text-center">{desc}</Text>
    </View>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Header() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="absolute top-0 left-0 right-0 z-50 px-5 pb-4 flex-row justify-between items-center bg-transparent"
    >
      <Pressable className="p-1 active:opacity-70">
        <Ionicons name="menu" size={28} color="#FFFFFF" />
      </Pressable>

      <Pressable className="p-1 active:opacity-70">
        <Ionicons name="chatbox-ellipses-outline" size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { JSX } from "react";
import { Pressable, View } from "react-native";
import Text from "./Text";

// Definisikan tab yang ingin ditampilkan
const ALLOWED_TABS = ["index", "route", "account"];

export default function CustomTabBar({ state, descriptors, navigation }: any) {
  const icons: Record<
    string,
    { active: JSX.Element; inactive: JSX.Element; label: string }
  > = {
    index: {
      active: <Ionicons name="home" size={22} color="#0F3FC1" />,
      inactive: <Ionicons name="home-outline" size={22} color="#737373" />,
      label: "Beranda",
    },
    route: {
      active: (
        <MaterialCommunityIcons name="routes" size={22} color="#0F3FC1" />
      ),
      inactive: (
        <MaterialCommunityIcons name="routes" size={22} color="#737373" />
      ),
      label: "Rute",
    },
    account: {
      active: <Ionicons name="person" size={22} color="#0F3FC1" />,
      inactive: <Ionicons name="person-outline" size={22} color="#737373" />,
      label: "Akun",
    },
  };

  // Filter hanya route yang diizinkan
  const filteredRoutes = state.routes.filter((route: any) =>
    ALLOWED_TABS.includes(route.name),
  );

  return (
    <View className="absolute -bottom-1 left-0 right-0 items-center">
      <View className="w-full bg-surface rounded-t-3xl pt-3 pb-6 px-6 flex-row justify-around items-center shadow-lg border-t border-x border-line">
        {filteredRoutes.map((route: any, index: number) => {
          // Cari index asli dari route untuk mengecek isFocused
          const originalIndex = state.routes.findIndex(
            (r: any) => r.key === route.key,
          );
          const isFocused = state.index === originalIndex;

          const item = icons[route.name] || {
            active: <Ionicons name="ellipse" size={22} color="#0F3FC1" />,
            inactive: (
              <Ionicons name="ellipse-outline" size={22} color="#737373" />
            ),
            label: route.name,
          };

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              className="items-center justify-center flex-1 py-1 active:opacity-70"
            >
              {isFocused ? item.active : item.inactive}
              <Text
                className={`text-xs mt-1 ${
                  isFocused
                    ? "text-brand-blue font-bold"
                    : "text-[#94A3B8] font-semibold"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

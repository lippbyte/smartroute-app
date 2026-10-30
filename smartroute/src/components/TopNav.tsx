// Bar atas di setiap halaman utama (sesuai desain): burger di kiri membuka
// menu samping, ikon pesan di kanan membuka layar "Tentang & Masukan"
// (Hari 3: layar penuh app/about.tsx, menggantikan lembar
// DeveloperInfoSheet). Satu komponen supaya perilakunya sama di semua halaman.
import SideMenu from "@/components/account/SideMenu";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

export default function TopNav() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Buka menu"
          className="w-10 h-10 items-center justify-center rounded-full active:bg-white/10"
        >
          <Ionicons name="menu" size={26} color="#FFFFFF" />
        </Pressable>
        <Pressable
          onPress={() => router.push("/about")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Tentang SmartRoute dan kirim masukan"
          className="w-10 h-10 items-center justify-center rounded-full active:bg-white/10"
        >
          <Ionicons name="chatbox-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

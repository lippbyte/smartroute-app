// Bar atas di setiap halaman utama (sesuai desain): burger di kiri membuka
// menu samping, ikon pesan di kanan membuka overlay "Tentang & Masukan".
// Satu komponen supaya perilakunya sama di semua halaman.
import DeveloperInfoSheet from "@/components/account/DeveloperInfoSheet";
import SideMenu from "@/components/account/SideMenu";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

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
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Tentang pengembang dan kirim masukan"
          className="w-10 h-10 items-center justify-center rounded-full active:bg-white/10"
        >
          <Ionicons name="chatbox-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      <DeveloperInfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}

// Latar setiap layar = gambar splash (Monas + patung Selamat Datang).
//
// Gambar dipasang PER LAYAR, bukan sekali di root layout dengan navigator
// transparan: tab yang tidak aktif dan layar di bawah stack tetap
// ter-render, jadi layar transparan memperlihatkan layar lain di
// belakangnya (halaman menumpuk saat navigasi). Latar ini opak.
import { ReactNode } from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

interface Props {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export default function ScreenBackground({ children, className, style }: Props) {
  return (
    <View className={`flex-1 ${className ?? ""}`} style={[styles.root, style]}>
      <Image
        source={require("@/assets/splash/splash-background.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#001C43" },
});

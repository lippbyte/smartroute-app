// Task App-23: animasi intro satu kali setelah splash native hilang — splash
// native (app.json/expo-splash-screen) hanya bisa gambar statis, jadi
// animasinya di sini. Latar = gambar yang SAMA dengan splash native
// (assets/splash/splash-background.png), jadi pergantiannya mulus.
//
// Judul & tagline sekarang teks langsung (bukan lagi gambar
// splash-background-with-text.png yang sudah berisi teks): gambar itu
// di-"cover" ke layar dengan rasio berbeda-beda, sehingga posisi teksnya
// ikut bergeser/terpotong. Teks yang di-flex ke tengah selalu tepat di
// tengah layar dengan jarak atas-bawah dan kiri-kanan yang sama.
//
// Overlay biasa saat mount (lihat _layout.tsx), bukan route: tidak masuk
// riwayat navigasi dan tidak pernah tampil dua kali dalam satu sesi.
import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

const TEXT_IN_DELAY_MS = 200;
const TEXT_IN_MS = 750;
const TAGLINE_LAG_MS = 180;
const HOLD_MS = 1000;
const FADE_OUT_MS = 450;

interface SplashIntroProps {
  onFinish: () => void;
}

export default function SplashIntro({ onFinish }: SplashIntroProps) {
  const title = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const animation = Animated.sequence([
      Animated.delay(TEXT_IN_DELAY_MS),
      Animated.parallel([
        Animated.timing(title, { toValue: 1, duration: TEXT_IN_MS, easing: ease, useNativeDriver: true }),
        Animated.timing(tagline, {
          toValue: 1,
          duration: TEXT_IN_MS,
          delay: TAGLINE_LAG_MS,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(HOLD_MS),
      // Seluruh overlay memudar ke layar app di bawahnya (latar app memakai
      // gambar yang sama, jadi hanya teksnya yang terlihat menghilang).
      Animated.timing(overlay, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onFinish();
    });
    return () => animation.stop();
  }, [onFinish, title, tagline, overlay]);

  const rise = (v: Animated.Value, px: number) => ({
    opacity: v,
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [px, 0] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: overlay }]}>
      <Image
        source={require("@/assets/splash/splash-background.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {/* Tepat di tengah: flex center pada seluruh layar, padding sama di
          keempat sisi supaya teks panjang tidak menempel ke tepi. */}
      <View style={styles.center}>
        <Animated.View style={rise(title, 14)}>
          <Text style={styles.title}>Smart Route AI</Text>
        </Animated.View>
        <Animated.View style={rise(tagline, 10)}>
          <Text style={styles.tagline}>Navigate Smarter. Travel Better.</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#001C43", zIndex: 100 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 6,
  },
  // Font variabel yang dimuat di _layout.tsx hanya "Plus-Jakarta-Sans";
  // komponen Text app memetakan tebal ke keluarga "-Bold" yang tidak
  // dimuat (di web jatuh ke serif), jadi di sini pakai Text RN langsung.
  title: {
    fontFamily: "Plus-Jakarta-Sans",
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  tagline: {
    fontFamily: "Plus-Jakarta-Sans",
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});

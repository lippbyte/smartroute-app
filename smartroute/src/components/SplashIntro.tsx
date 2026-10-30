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
//
// Hari 2 Task 5: judul teks diganti LOGO RESMI (PNG putih transparan,
// assets/images/logo-smartroute-white.png — PNG, bukan SVG: lihat laporan
// Hari 2, modul native react-native-svg belum pasti ada di Dev Client).
// Logo berada di atas tiang Monas yang berpola, jadi di belakangnya ada
// "lingkaran gelap radial": beberapa lingkaran konsentris semi-transparan
// (tanpa pustaka gradien/native). Lingkaran ikut memudar MASUK bersama logo,
// jadi frame pertama overlay identik dengan splash native (tanpa kedip).
// Latar tetap #001C43 (sama dengan splash native — keputusan Khalifa).
// Durasi animasi tidak berubah.
import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";

const LOGO = require("@/assets/images/logo-smartroute-white.png");
const LOGO_ASPECT = 909 / 200; // ukuran berkas setelah ruang kosong dipotong
// Lingkaran luar -> dalam: makin ke tengah makin gelap. 7 lapis tipis
// (bukan 4 tebal) supaya tepinya tidak tampak sebagai pita bertingkat —
// dicek lewat pratinjau gambar di atas splash-background.png.
const BACKDROP_RINGS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];

const TEXT_IN_DELAY_MS = 200;
const TEXT_IN_MS = 750;
const TAGLINE_LAG_MS = 180;
const HOLD_MS = 1000;
const FADE_OUT_MS = 450;

interface SplashIntroProps {
  onFinish: () => void;
}

export default function SplashIntro({ onFinish }: SplashIntroProps) {
  const { width } = useWindowDimensions();
  const logoWidth = Math.min(300, width - 72);
  const backdrop = logoWidth * 1.15;
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
        {/* Lingkaran gelap di belakang logo — memudar masuk bersama logo. */}
        <Animated.View pointerEvents="none" style={[styles.backdropWrap, { opacity: title }]}>
          {BACKDROP_RINGS.map((scale) => (
            <View
              key={scale}
              style={[
                styles.ring,
                { width: backdrop * scale, height: backdrop * scale, borderRadius: (backdrop * scale) / 2 },
              ]}
            />
          ))}
        </Animated.View>
        <Animated.View style={rise(title, 14)}>
          <Image
            source={LOGO}
            style={{ width: logoWidth, height: logoWidth / LOGO_ASPECT }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="SmartRoute"
          />
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
    gap: 10,
  },
  backdropWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  // Navy lebih gelap dari latar, ditumpuk 7 lapis -> efek radial.
  ring: {
    position: "absolute",
    backgroundColor: "rgba(0, 12, 32, 0.13)",
  },
  // Font variabel yang dimuat di _layout.tsx hanya "Plus-Jakarta-Sans";
  // komponen Text app memetakan tebal ke keluarga "-Bold" yang tidak
  // dimuat (di web jatuh ke serif), jadi di sini pakai Text RN langsung.
  tagline: {
    fontFamily: "Plus-Jakarta-Sans",
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});

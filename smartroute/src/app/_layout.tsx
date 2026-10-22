import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { View } from "react-native";
import SplashIntro from "@/components/SplashIntro";
import "../../global.css";

// Latar navigator OPAK (biru malam splash). Gambar latar dipasang per
// layar lewat components/ScreenBackground.tsx — navigator transparan membuat
// layar yang tidak aktif ikut terlihat (halaman menumpuk).
const APP_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "#001C43", card: "#001C43" },
};

// Task App-23: keep the native splash (static background image, per
// app.json) on screen until fonts are ready AND our custom intro overlay is
// about to render its first frame — otherwise the native splash would hide
// itself as soon as JS starts, exposing a blank/spinner frame before the
// intro's background image paints. Must be called at module scope, before
// the component mounts.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Plus-Jakarta-Sans": require("@/assets/fonts/PlusJakartaSans-VariableFont_wght.ttf"),
  });
  // Starts true so the intro overlay is what the native splash hands off
  // to; flips to false once, permanently, when SplashIntro finishes — a
  // plain state toggle, not a route, so it has no navigation history entry
  // and can never be revisited or re-shown later in the same app session.
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    if (fontsLoaded) {
      // The intro overlay's background image is a bundled local asset, so
      // it's already painted by the time this effect runs — hiding the
      // native splash here is a same-frame swap, not a flash to blank.
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Native splash is still covering the screen (see preventAutoHideAsync
    // above) — nothing to render yet.
    return null;
  }

  return (
    <ThemeProvider value={APP_THEME}>
      <View style={{ flex: 1, backgroundColor: "#001C43" }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#001C43" },
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
        {/* Intro di ATAS app yang sudah dirender, supaya fade-out-nya
            langsung memperlihatkan Beranda, bukan layar kosong. */}
        {showIntro && <SplashIntro onFinish={() => setShowIntro(false)} />}
      </View>
    </ThemeProvider>
  );
}

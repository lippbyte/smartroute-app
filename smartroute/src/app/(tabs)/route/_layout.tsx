// src/app/(tabs)/route/_layout.tsx
//
// Task App-12: sebelum ini, route.tsx (daftar hasil) dan route/[id].tsx
// (detail) sama-sama flat langsung di dalam grup (tabs) — tanpa layout Stack
// sendiri, Expo Router memperlakukan keduanya sebagai layar sejajar di
// dalam Tabs navigator yang sama. Akibatnya navigasi index -> [id] itu
// SWITCH TAB, bukan push ke stack, jadi tombol back HP tidak punya riwayat
// untuk di-back-kan selangkah — langsung jatuh ke tab sebelumnya (Beranda).
//
// Stack di sini menjadikan tab "Rute" punya riwayat navigasi sendiri:
// index (daftar hasil) -> [id] (detail) adalah push sungguhan di dalam
// stack ini. Begitu balik ke root stack ini (index) dan back ditekan lagi,
// baru itu jatuh ke tab-switch-behavior bawaan Tabs navigator (kembali ke
// tab Beranda) — persis urutan yang diminta AC: detail -> daftar -> beranda.
import { Stack } from "expo-router";

export default function RouteStackLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#001C43" } }}
    />
  );
}

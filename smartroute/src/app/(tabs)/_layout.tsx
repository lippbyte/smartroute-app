import CustomTabBar from "@/components/CustomTabBar";
import { useAuth } from "@/context/AuthContext";
import { Redirect, Tabs } from "expo-router";

export default function TabsLayout() {
  // Hari 1 Task 2: belum masuk DAN belum memilih tamu -> layar Masuk (yang
  // selalu menawarkan "Lanjut sebagai tamu"). Tamu & pengguna masuk lewat.
  // Juga menangkap sesi yang berakhir di tengah pemakaian. Selama sesi
  // tersimpan dibaca (sekejap), intro splash masih menutupi layar.
  const { status } = useAuth();
  if (status === "loading") return null;
  if (status === "signedOut") return <Redirect href="/login" />;

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "#001C43" } }}
      // Task App-12: default bawaan Tabs navigator adalah "firstRoute"
      // (selalu balik ke tab pertama, terlepas dari tab mana yang benar-benar
      // dikunjungi sebelumnya) — bukan "history" seperti yang biasa diasumsikan.
      // Kebetulan cocok untuk alur Beranda->Rute saat ini (Beranda memang tab
      // pertama), tapi itu kebenaran yang rapuh. "history" membuat tombol back
      // benar-benar mengikuti urutan tab yang dialami user, sesuai prinsip
      // task ini — bukan asumsi urutan tab yang di-hardcode.
      backBehavior="history"
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="route" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

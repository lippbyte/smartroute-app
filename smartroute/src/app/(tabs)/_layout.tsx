import CustomTabBar from "@/components/CustomTabBar";
import { Tabs } from "expo-router";

export default function TabsLayout() {
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

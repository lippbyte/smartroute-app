// Kartu "Tampilan & bantuan" di Profil — Hari 3 Task 2. Untuk semua
// pengguna (termasuk tamu): pengaturan tersimpan di perangkat, bukan di
// server. Bantuan yang aktif karena profil aksesibilitas ditandai
// "diusulkan dari profil"; profil tersimpan tidak pernah diubah dari sini.
import Text from "@/components/Text";
import { useAssistive } from "@/context/AssistiveSettingsContext";
import type { AssistiveKey } from "@/utils/assistiveSettings";
import { Pressable, Switch, View } from "react-native";

const ITEMS: Array<{ key: AssistiveKey; label: string; description: string }> = [
  {
    key: "showA11yInfo",
    label: "Info aksesibilitas kursi roda",
    description:
      "Menampilkan pilihan \"Tampilkan info aksesibilitas\" di hasil rute: status halte menurut data GTFS. Belum mengubah rute yang disarankan.",
  },
  {
    key: "easyRead",
    label: "Tampilan mudah dibaca",
    description: "Huruf lebih besar dan teks sekunder lebih kontras.",
  },
  {
    key: "bigAlerts",
    label: "Peringatan teks besar + getar",
    description: "Saat navigasi, pindah langkah dan tiba di tujuan ditandai teks besar dan getaran, tanpa suara.",
  },
  {
    key: "simpleNav",
    label: "Mode sederhana saat navigasi",
    description: "Satu langkah per layar, bahasa lugas, tanpa peta dan animasi.",
  },
  {
    key: "emphasizeWalk",
    label: "Tonjolkan jalan kaki & transfer",
    description: "Jarak jalan kaki dan jumlah transfer tampil lebih menonjol di kartu rute. Urutan rute tidak berubah.",
  },
];

export default function AssistiveSettingsCard() {
  const { settings, setChoice } = useAssistive();

  return (
    <View className="bg-surface w-full px-5 py-4 rounded-2xl border border-line gap-1">
      <Text className="text-ink font-bold text-lg" accessibilityRole="header">
        Tampilan & bantuan
      </Text>
      <Text className="text-ink-2 text-xs">Tersimpan di perangkat ini. Profil akun Anda tidak diubah.</Text>

      {ITEMS.map(({ key, label, description }, i) => {
        const s = settings[key];
        return (
          <Pressable
            key={key}
            onPress={() => setChoice(key, !s.on)}
            accessibilityRole="switch"
            accessibilityState={{ checked: s.on }}
            accessibilityLabel={label}
            accessibilityHint={description}
            className={`flex-row items-center gap-3 py-3 ${i < ITEMS.length - 1 ? "border-b border-line" : ""}`}
            style={{ minHeight: 56 }}
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-ink text-[15px]" weight="semibold">
                {label}
              </Text>
              <Text className="text-ink-2 text-xs" style={{ lineHeight: 17 }}>
                {description}
              </Text>
              {s.suggested && (
                <Text className="text-xs" weight="semibold" style={{ color: "#065F46" }}>
                  Aktif karena diusulkan dari profil aksesibilitas Anda
                </Text>
              )}
            </View>
            <Switch
              value={s.on}
              onValueChange={(v) => setChoice(key, v)}
              trackColor={{ false: "#A3A3A3", true: "#0F3FC1" }}
              thumbColor="#FFFFFF"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </Pressable>
        );
      })}

      <View className="rounded-xl p-3 mt-2 gap-1" style={{ backgroundColor: "#F4F4F0" }}>
        <Text className="text-ink text-xs" weight="bold">
          Yang sudah bekerja
        </Text>
        <Text className="text-ink-2 text-xs" style={{ lineHeight: 17 }}>
          Info status halte untuk kursi roda (dari data GTFS), tampilan mudah dibaca, peringatan teks + getar, mode
          sederhana, dan penonjolan jalan kaki/transfer.
        </Text>
        <Text className="text-ink text-xs mt-1" weight="bold">
          Masih dikembangkan
        </Text>
        <Text className="text-ink-2 text-xs" style={{ lineHeight: 17 }}>
          Rute yang otomatis menghindari halte tak aksesibel; data aksesibilitas stasiun KRL, MRT, dan LRT serta armada
          (belum tersedia di data yang kami pakai).
        </Text>
      </View>
    </View>
  );
}

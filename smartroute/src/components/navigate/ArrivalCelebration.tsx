// src/components/navigate/ArrivalCelebration.tsx
//
// Task App-13 (lanjutan): layar selamat saat navigasi selesai. Sebelumnya
// penutup perjalanan cuma kartu kecil di bawah (branch isFinished di
// StepCard) yang tenggelam di antara peta — kurang terasa sebagai penutup.
// Ini menggantikannya dengan layar penuh: ucapan selamat, nama tujuan yang
// terbaca manusia, ringkasan perjalanan, dan satu tombol lanjut yang
// BENAR-BENAR kembali ke Beranda (lihat catatan di navigate.tsx — tombol
// lama memakai router.back() yang cuma mundur satu layar ke detail rute).
import Text from "@/components/Text";
import { RouteItem } from "@/type";
import { formatRupiah } from "@/utils/currency";
import { formatDepartureLabel } from "@/utils/departureTime";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

interface ArrivalCelebrationProps {
  routeData: RouteItem;
  /**
   * Nama tujuan yang enak dibaca. Bisa null selagi reverse-geocode masih
   * jalan atau kalau memang gagal — komponen ini menyembunyikan barisnya
   * daripada menampilkan string koordinat mentah ke user.
   */
  destinationLabel: string | null;
  onGoHome: () => void;
}

export default function ArrivalCelebration({
  routeData,
  destinationLabel,
  onGoHome,
}: ArrivalCelebrationProps) {
  // Task App-20: waktu berangkat yang BENAR-BENAR dipakai backend untuk
  // hitung jadwal rute ini (lihat catatan RouteItem.departure_time) —
  // konfirmasi visual bahwa waktu custom yang diisi di Beranda memang
  // dipakai, bukan cuma "sekarang" diam-diam.
  const departureLabel = routeData.departure_time
    ? formatDepartureLabel(routeData.departure_time)
    : null;

  const summary: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    ...(departureLabel
      ? [{ icon: "calendar-outline" as const, label: `Berangkat ${departureLabel}` }]
      : []),
    { icon: "time-outline", label: `${routeData.travel_time_minutes} mnt` },
    { icon: "swap-horizontal", label: `${routeData.transfers}x transit` },
    { icon: "wallet-outline", label: formatRupiah(routeData.cost_idr) },
  ];

  return (
    <View className="absolute inset-0 bg-surface items-center justify-center px-8 gap-6 z-20">
      <View className="w-24 h-24 rounded-full bg-primary-emerald/20 items-center justify-center">
        <Ionicons name="checkmark-circle" size={64} color="#018959" />
      </View>

      <View className="items-center gap-2">
        <Text className="text-ink font-bold text-3xl text-center">
          Selamat! 🎉
        </Text>
        {destinationLabel && (
          <Text className="text-ink-2 text-base text-center">
            Anda telah tiba di {destinationLabel}
          </Text>
        )}
        <Text className="text-muted text-sm text-center mt-1">
          Terima kasih telah menggunakan SmartRoute AI. Semoga harimu
          menyenangkan!
        </Text>
      </View>

      <View className="flex-row gap-3 flex-wrap justify-center">
        {summary.map((item) => (
          <View
            key={item.label}
            className="flex-row items-center gap-1.5 bg-surface-2 px-3.5 py-2 rounded-full border border-line"
          >
            <Ionicons name={item.icon} size={14} color="#737373" />
            <Text className="text-ink-2 text-xs">{item.label}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onGoHome}
        className="w-full bg-brand-blue py-4 rounded-2xl items-center active:opacity-90 mt-2"
      >
        <Text className="text-white font-bold text-base">
          Kembali ke Beranda
        </Text>
      </Pressable>
    </View>
  );
}

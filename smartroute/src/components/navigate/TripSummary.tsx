// src/components/navigate/TripSummary.tsx
//
// Hari 1 Task 5: Ringkasan Perjalanan — menggantikan layar "Selamat"
// (ArrivalCelebration). Menampilkan rute, moda, transfer, jalan kaki,
// durasi, dan tarif total dari backend (tidak dihitung ulang).
//
// Durasi: "Aktual" HANYA bila navigasi selesai lewat trigger kedatangan
// 75 m (actualMinutes != null); selesai lewat tombol manual = "Estimasi".
//
// Riwayat: pengguna yang masuk -> otomatis tersimpan (client_ref yang sama
// dipakai saat "Coba lagi", jadi tidak ada entri dobel). Tamu -> ajakan
// masuk, TANPA panggilan ke server. Status dibaca sekali saat layar ini
// muncul: perjalanan tamu tidak disimpan meski ia masuk sesudahnya
// (migrasi riwayat tamu di luar cakupan Hari 1).
import { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import Text from "@/components/Text";
import RatingSheet from "@/components/trip/RatingSheet";
import { DurationBadge, durationNote, LegChain } from "@/components/trip/TripBits";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import * as tripService from "@/services/tripService";
import type { Trip } from "@/services/tripService";
import { RouteItem } from "@/type";
import { formatCo2, percentVs } from "@/utils/co2Format";
import { formatRupiah } from "@/utils/currency";
import { durationDisplay } from "@/utils/tripFormat";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

interface Props {
  route: RouteItem;
  originName: string;
  destinationName: string;
  /** Menit sejak navigasi dimulai — HANYA diisi bila tiba via trigger 75 m. */
  actualMinutes: number | null;
  clientRef: string;
  onGoHome: () => void;
}

type SaveState = { kind: "guest" } | { kind: "saving" } | { kind: "saved"; trip: Trip } | { kind: "error"; message: string };

export default function TripSummary({ route, originName, destinationName, actualMinutes, clientRef, onGoHome }: Props) {
  const router = useRouter();
  const { status, token } = useAuth();
  const signedInAtArrival = useRef(status === "signedIn" && !!token).current;
  const [save, setSave] = useState<SaveState>(signedInAtArrival ? { kind: "saving" } : { kind: "guest" });
  const [rating, setRating] = useState(false);

  const input = useRef(
    tripService.buildTripInput({ clientRef, route, originLabel: originName, destinationLabel: destinationName, actualMinutes }),
  ).current;

  const persist = async () => {
    if (!token) return;
    setSave({ kind: "saving" });
    try {
      setSave({ kind: "saved", trip: await tripService.createTrip(token, input) });
    } catch (err) {
      setSave({ kind: "error", message: err instanceof ApiError ? err.message : "Gagal menyimpan perjalanan." });
    }
  };

  useEffect(() => {
    if (signedInAtArrival) void persist();
    // Sekali saat layar muncul; "Coba lagi" memanggil persist() lagi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const display = durationDisplay({
    basis: input.duration_basis,
    actualMin: input.actual_duration_min,
    predicted: input.predicted_min_range,
    fallbackMin: route.travel_time_minutes,
  });
  const walkM = Math.round(route.walking_distance_m);

  return (
    <View className="absolute inset-0 bg-surface z-20">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 64, paddingBottom: 40, gap: 18 }}>
        <View className="items-center gap-2">
          <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: "#D1FAE5" }}>
            <Ionicons name="flag" size={32} color="#065F46" />
          </View>
          <Text className="text-ink text-2xl text-center" weight="bold" accessibilityRole="header">
            Ringkasan Perjalanan
          </Text>
          <Text className="text-ink-2 text-base text-center" numberOfLines={3}>
            {originName} → {destinationName}
          </Text>
        </View>

        <View className="bg-white rounded-2xl border border-line p-4 gap-4">
          <View className="gap-2">
            <Text className="text-ink-2 text-sm" weight="semibold">
              Moda yang dipakai
            </Text>
            <LegChain modes={route.legs.map((l) => l.mode)} />
          </View>

          <View className="flex-row gap-3">
            <SummaryStat icon="swap-horizontal" label="Transfer" value={`${route.transfers}x`} />
            <SummaryStat icon="walk" label="Jalan kaki" value={walkM >= 1000 ? `${(walkM / 1000).toFixed(1).replace(".", ",")} km` : `${walkM} m`} />
            <SummaryStat icon="wallet-outline" label="Tarif total" value={formatRupiah(route.cost_idr)} />
          </View>

          <View className="gap-1.5 pt-3 border-t border-line">
            <Text className="text-ink-2 text-sm" weight="semibold">
              Durasi
            </Text>
            <DurationBadge display={display} />
            <Text className="text-ink-2 text-xs" style={{ lineHeight: 18 }}>
              {durationNote(display)}
            </Text>
          </View>

          {/* Hari 2: estimasi CO₂ — perbandingan hanya terhadap pembanding
              untuk jarak (proksi) yang sama, dilabeli; tanpa klaim "hemat". */}
          {route.co2 && (
            <View className="gap-1.5 pt-3 border-t border-line">
              <Text className="text-ink-2 text-sm" weight="semibold">
                Jejak karbon
              </Text>
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="leaf-outline" size={18} color="#065F46" />
                <Text className="text-ink text-base" weight="bold">
                  ≈ {formatCo2(route.co2.estimate_g)} CO₂ (estimasi)
                </Text>
              </View>
              <Text className="text-ink-2 text-xs" style={{ lineHeight: 18 }}>
                {[
                  percentVs(route.co2.estimate_g, route.co2.car_g) && `${percentVs(route.co2.estimate_g, route.co2.car_g)} vs mobil sendirian`,
                  percentVs(route.co2.estimate_g, route.co2.motorcycle_g) && `${percentVs(route.co2.estimate_g, route.co2.motorcycle_g)} vs motor`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {` untuk jarak proksi ${(route.co2.comparator_distance_m / 1000).toFixed(1).replace(".", ",")} km.`}
              </Text>
              <Pressable onPress={() => router.push("/co2-info")} accessibilityRole="link" hitSlop={6} className="self-start">
                <Text className="text-xs underline" weight="semibold" style={{ color: "#0F3FC1" }}>
                  Tentang angka ini
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {save.kind === "guest" && (
          <View className="rounded-2xl p-4 gap-3" style={{ backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE" }}>
            <Text className="text-ink text-[15px]" style={{ lineHeight: 22 }}>
              Perjalanan ini tidak disimpan karena Anda memakai mode tamu. Masuk untuk menyimpan riwayat perjalanan
              berikutnya dan memberi penilaian.
            </Text>
            <PrimaryButton label="Masuk untuk menyimpan riwayat" variant="outline" onPress={() => router.push("/login")} />
          </View>
        )}
        {save.kind === "saving" && (
          <View className="flex-row items-center gap-2 justify-center" accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color="#0F3FC1" />
            <Text className="text-ink-2 text-sm">Menyimpan ke riwayat…</Text>
          </View>
        )}
        {save.kind === "saved" && (
          <View className="flex-row items-center gap-2 justify-center" accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={18} color="#065F46" />
            <Text className="text-sm" style={{ color: "#065F46" }} weight="semibold">
              Tersimpan di Riwayat
            </Text>
          </View>
        )}
        {save.kind === "error" && (
          <View className="gap-2">
            <FormMessage tone="error" message={`Perjalanan belum tersimpan. ${save.message}`} />
            <PrimaryButton label="Coba simpan lagi" variant="outline" onPress={persist} />
          </View>
        )}

        <View className="gap-3">
          {save.kind === "saved" && !save.trip.rating && (
            <PrimaryButton label="Beri penilaian" variant="outline" onPress={() => setRating(true)} />
          )}
          <PrimaryButton label="Selesai" onPress={onGoHome} accessibilityHint="Kembali ke Beranda" />
        </View>
      </ScrollView>

      {save.kind === "saved" && token && (
        <RatingSheet
          visible={rating}
          token={token}
          trip={save.trip}
          onClose={() => setRating(false)}
          onRated={(trip) => setSave({ kind: "saved", trip })}
        />
      )}
    </View>
  );
}

function SummaryStat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View className="flex-1 bg-surface-2 rounded-xl px-2.5 py-3 gap-1 items-center">
      <Ionicons name={icon} size={18} color="#404040" />
      <Text className="text-ink text-sm text-center" weight="bold" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="text-ink-2 text-xs text-center">{label}</Text>
    </View>
  );
}

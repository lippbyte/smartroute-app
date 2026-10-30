// Layar Riwayat Perjalanan. Hari 1 Task 5: data ASLI dari GET /trips
// (sebelumnya daftar & angka karangan: "24 perjalanan", "Rp336rb hemat",
// "28,8 kg CO₂"). Terbaru dulu; ketuk untuk detail. CO₂ belum dihitung
// (Hari 2) — ditampilkan "—", bukan angka tebakan. Tamu melihat ajakan
// masuk, tanpa panggilan ke server.
import PrimaryButton from "@/components/form/PrimaryButton";
import { FormMessage } from "@/components/form/FormField";
import ScreenBackground from "@/components/ScreenBackground";
import Text from "@/components/Text";
import TopNav from "@/components/TopNav";
import { DurationBadge, LegChain, Stars } from "@/components/trip/TripBits";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import { listTrips, type Trip } from "@/services/tripService";
import { formatRupiah } from "@/utils/currency";
import { durationDisplay, formatTripDate } from "@/utils/tripFormat";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function groupByMonth(trips: Trip[]): { title: string; data: Trip[] }[] {
  const groups: { title: string; data: Trip[] }[] = [];
  for (const t of trips) {
    const d = new Date(t.created_at);
    const title = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    const last = groups[groups.length - 1];
    if (last?.title === title) last.data.push(t);
    else groups.push({ title, data: [t] });
  }
  return groups;
}

function SummaryCard({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 bg-surface rounded-2xl py-3.5 px-2 items-center gap-1 border border-line">
      <Text className="text-ink font-bold text-lg" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="text-ink-2 text-xs text-center" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const display = durationDisplay({ basis: trip.duration_basis, actualMin: trip.actual_duration_min, predicted: trip.predicted_min_range });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.origin_label} ke ${trip.destination_label}, ${formatTripDate(trip.created_at)}. Ketuk untuk detail.`}
      className="bg-surface rounded-2xl p-4 gap-3 border border-line active:opacity-80"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-ink font-bold text-base" numberOfLines={2}>
            {trip.origin_label}
            <Text className="text-ink-2 font-bold text-base"> → </Text>
            {trip.destination_label}
          </Text>
          <Text className="text-ink-2 text-xs">{formatTripDate(trip.created_at)}</Text>
        </View>
        <View className="items-end gap-1">
          <Text className="text-ink font-bold text-base">{formatRupiah(trip.fare_total)}</Text>
          {trip.rating ? <Stars value={trip.rating.stars} /> : <Text className="text-ink-2 text-xs">Belum dinilai</Text>}
        </View>
      </View>
      <View className="flex-row items-center justify-between gap-3 pt-3 border-t border-line">
        <View className="flex-1">
          <LegChain modes={trip.route_summary.legs.map((l) => l.mode)} size={14} />
        </View>
        <DurationBadge display={display} compact />
      </View>
    </Pressable>
  );
}

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; trips: Trip[] };

export default function HistoryScreen() {
  const router = useRouter();
  const { status, token } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    if (!token) return;
    setState((s) => (s.kind === "ready" ? s : { kind: "loading" }));
    try {
      setState({ kind: "ready", trips: await listTrips(token) });
    } catch (err) {
      setState({ kind: "error", message: err instanceof ApiError ? err.message : "Gagal memuat riwayat." });
    }
  }, [token]);

  // Muat ulang setiap kali layar dibuka (mis. setelah perjalanan baru).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const signedIn = status === "signedIn" && !!token;

  return (
    <ScreenBackground>
      {/* ScrollView biasa, bukan SectionList: di web contentContainerClassName
          SectionList tidak diterapkan NativeWind (padding hilang). */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 48, paddingBottom: 120, paddingHorizontal: 20, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <TopNav />

        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.navigate("/account"))}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            className="bg-surface p-2.5 rounded-full border border-line"
          >
            <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
          </Pressable>
          <Text className="text-2xl font-bold text-white" accessibilityRole="header">
            Riwayat Perjalanan
          </Text>
        </View>

        {!signedIn && (
          <View className="bg-surface rounded-2xl p-5 gap-4 border border-line">
            <Text className="text-ink text-lg" weight="bold">
              Masuk untuk melihat riwayat
            </Text>
            <Text className="text-ink-2 text-[15px]" style={{ lineHeight: 22 }}>
              Riwayat perjalanan dan penilaian disimpan di akun Anda. Mode tamu tidak menyimpan riwayat.
            </Text>
            <PrimaryButton label="Masuk / Daftar" onPress={() => router.push("/login")} />
          </View>
        )}

        {signedIn && state.kind === "loading" && (
          <View className="items-center py-10 gap-3" accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text className="text-white text-sm">Memuat riwayat…</Text>
          </View>
        )}

        {signedIn && state.kind === "error" && (
          <View className="bg-surface rounded-2xl p-4 gap-3 border border-line">
            <FormMessage tone="error" message={state.message} />
            <PrimaryButton label="Coba lagi" variant="outline" onPress={load} />
          </View>
        )}

        {signedIn && state.kind === "ready" && state.trips.length === 0 && (
          <View className="bg-surface rounded-2xl p-6 gap-4 border border-line items-center">
            <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: "#EEF2FF" }}>
              <Ionicons name="map-outline" size={30} color="#0F3FC1" />
            </View>
            <Text className="text-ink text-lg text-center" weight="bold">
              Belum ada perjalanan tersimpan
            </Text>
            <Text className="text-ink-2 text-[15px] text-center" style={{ lineHeight: 22 }}>
              Cari rute, lalu mulai navigasi. Perjalanan yang Anda selesaikan akan muncul di sini.
            </Text>
            <View className="w-full">
              <PrimaryButton label="Cari rute" onPress={() => router.navigate("/")} />
            </View>
          </View>
        )}

        {signedIn && state.kind === "ready" && state.trips.length > 0 && (
          <>
            <View className="flex-row gap-2">
              <SummaryCard value={String(state.trips.length)} label="Perjalanan" />
              <SummaryCard value={formatRupiah(state.trips.reduce((sum, t) => sum + t.fare_total, 0))} label="Total tarif" />
              {/* CO₂ dihitung mulai Hari 2 — sampai itu kosong, bukan tebakan. */}
              <SummaryCard value="—" label="CO₂ (belum dihitung)" />
            </View>
            {groupByMonth(state.trips).map((group) => (
              <View key={group.title} className="gap-3">
                <Text className="text-surface-2 text-sm font-bold uppercase tracking-wider">{group.title}</Text>
                {group.data.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onPress={() => router.push({ pathname: "/trip/[id]", params: { id: trip.id } })} />
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

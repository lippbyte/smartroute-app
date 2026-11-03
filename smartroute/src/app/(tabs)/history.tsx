// Layar Riwayat Perjalanan. Hari 1 Task 5: data ASLI dari GET /trips
// (sebelumnya daftar & angka karangan: "24 perjalanan", "Rp336rb hemat",
// "28,8 kg CO₂"). Terbaru dulu; ketuk untuk detail. CO₂ (Hari 2) = jumlah
// estimasi dari perjalanan yang punya data saja, berlabel. Tamu melihat
// ajakan masuk, tanpa panggilan ke server.
import PrimaryButton from "@/components/form/PrimaryButton";
import { FormMessage } from "@/components/form/FormField";
import ScreenBackground from "@/components/ScreenBackground";
import Text from "@/components/Text";
import TopNav from "@/components/TopNav";
import { DurationBadge, LegChain, Stars } from "@/components/trip/TripBits";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import { listTrips, type Trip } from "@/services/tripService";
import { formatCo2 } from "@/utils/co2Format";
import { formatRupiah } from "@/utils/currency";
import { durationDisplay, formatTripDate } from "@/utils/tripFormat";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { monthLong, t } from "@/i18n";

function groupByMonth(trips: Trip[]): { title: string; data: Trip[] }[] {
  const groups: { title: string; data: Trip[] }[] = [];
  for (const t of trips) {
    const d = new Date(t.created_at);
    const title = `${monthLong(d.getMonth())} ${d.getFullYear()}`;
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
      accessibilityLabel={t("history.cardLabel", { from: trip.origin_label, to: trip.destination_label, date: formatTripDate(trip.created_at) })}
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
          {trip.rating ? <Stars value={trip.rating.stars} /> : <Text className="text-ink-2 text-xs">{t("history.notRated")}</Text>}
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
      setState({ kind: "error", message: err instanceof ApiError ? err.message : t("history.loadError") });
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
            accessibilityLabel={t("common.back")}
            className="bg-surface p-2.5 rounded-full border border-line"
          >
            <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
          </Pressable>
          <Text className="text-2xl font-bold text-white" accessibilityRole="header">
            {t("history.title")}
          </Text>
        </View>

        {!signedIn && (
          <View className="bg-surface rounded-2xl p-5 gap-4 border border-line">
            <Text className="text-ink text-lg" weight="bold">
              {t("history.signInTitle")}
            </Text>
            <Text className="text-ink-2 text-[15px]" style={{ lineHeight: 22 }}>
              {t("history.signInBody")}
            </Text>
            <PrimaryButton label={t("common.signInOrUp")} onPress={() => router.push("/login")} />
          </View>
        )}

        {signedIn && state.kind === "loading" && (
          <View className="items-center py-10 gap-3" accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text className="text-white text-sm">{t("history.loading")}</Text>
          </View>
        )}

        {signedIn && state.kind === "error" && (
          <View className="bg-surface rounded-2xl p-4 gap-3 border border-line">
            <FormMessage tone="error" message={state.message} />
            <PrimaryButton label={t("common.retry")} variant="outline" onPress={load} />
          </View>
        )}

        {signedIn && state.kind === "ready" && state.trips.length === 0 && (
          <View className="bg-surface rounded-2xl p-6 gap-4 border border-line items-center">
            <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: "#EEF2FF" }}>
              <Ionicons name="map-outline" size={30} color="#0F3FC1" />
            </View>
            <Text className="text-ink text-lg text-center" weight="bold">
              {t("history.emptyTitle")}
            </Text>
            <Text className="text-ink-2 text-[15px] text-center" style={{ lineHeight: 22 }}>
              {t("history.emptyBody")}
            </Text>
            <View className="w-full">
              <PrimaryButton label={t("history.search")} onPress={() => router.navigate("/")} />
            </View>
          </View>
        )}

        {signedIn && state.kind === "ready" && state.trips.length > 0 && (
          <>
            <View className="flex-row gap-2">
              <SummaryCard value={String(state.trips.length)} label={t("history.trips")} />
              <SummaryCard value={formatRupiah(state.trips.reduce((sum, t) => sum + t.fare_total, 0))} label={t("history.totalFare")} />
              {/* Hari 2: total hanya dari perjalanan yang PUNYA estimasi CO₂
                  (perjalanan sebelum Hari 2 tidak punya) — jumlahnya ikut
                  dicantumkan, tanpa klaim "hemat". */}
              {(() => {
                const withCo2 = state.trips.filter((t) => t.co2_estimate_g != null);
                const total = withCo2.reduce((sum, t) => sum + (t.co2_estimate_g ?? 0), 0);
                return withCo2.length === 0 ? (
                  <SummaryCard value="—" label={t("history.co2")} />
                ) : (
                  <SummaryCard value={`≈ ${formatCo2(total)}`} label={t("history.co2Count", { n: withCo2.length, total: state.trips.length })} />
                );
              })()}
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

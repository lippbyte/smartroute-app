// src/app/trip/[id].tsx
//
// Hari 1 Task 5/6: detail satu perjalanan di riwayat + penilaiannya.
// Perjalanan yang belum dinilai bisa dinilai dari sini (sekali saja).
import { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import ScreenBackground from "@/components/ScreenBackground";
import Text from "@/components/Text";
import RatingSheet from "@/components/trip/RatingSheet";
import { DurationBadge, durationNote, LegChain, Stars } from "@/components/trip/TripBits";
import { legModeStyle } from "@/components/transit/legModes";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import { getTrip, type Trip } from "@/services/tripService";
import { formatCo2 } from "@/utils/co2Format";
import { formatRupiah } from "@/utils/currency";
import { durationDisplay, formatTripDate } from "@/utils/tripFormat";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

const ANSWER_LABEL = (v: boolean | null) => (v === null ? "Dilewati" : v ? "Ya" : "Tidak");

export default function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, token } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      setTrip(await getTrip(token, id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat perjalanan.");
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.navigate("/history"));

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingTop: 56, paddingBottom: 48, paddingHorizontal: 20, gap: 16 }}>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Kembali" className="bg-surface p-2.5 rounded-full border border-line">
            <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
          </Pressable>
          <Text className="text-2xl font-bold text-white" accessibilityRole="header">
            Detail Perjalanan
          </Text>
        </View>

        {status !== "signedIn" && (
          <View className="bg-surface rounded-2xl p-5 gap-3 border border-line">
            <Text className="text-ink-2 text-[15px]">Masuk untuk melihat riwayat perjalanan.</Text>
            <PrimaryButton label="Masuk" onPress={() => router.push("/login")} />
          </View>
        )}

        {error && (
          <View className="bg-surface rounded-2xl p-4 gap-3 border border-line">
            <FormMessage tone="error" message={error} />
            <PrimaryButton label="Coba lagi" variant="outline" onPress={load} />
          </View>
        )}

        {status === "signedIn" && !trip && !error && (
          <View className="items-center py-10">
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        {trip && (
          <>
            <View className="bg-surface rounded-2xl p-4 gap-4 border border-line">
              <View className="gap-1">
                <Text className="text-ink text-lg" weight="bold">
                  {trip.origin_label} → {trip.destination_label}
                </Text>
                <Text className="text-ink-2 text-sm">{formatTripDate(trip.created_at)}</Text>
              </View>
              <LegChain modes={trip.route_summary.legs.map((l) => l.mode)} />
              <View className="gap-2.5">
                {trip.route_summary.legs.map((leg, i) => (
                  <View key={i} className="flex-row gap-2">
                    <Text className="text-ink text-sm" weight="semibold" style={{ minWidth: 92 }}>
                      {legModeStyle(leg.mode).label}
                      {leg.service ? ` ${leg.service}` : ""}
                    </Text>
                    <Text className="text-ink-2 text-sm flex-1">
                      {leg.from} → {leg.to}
                    </Text>
                  </View>
                ))}
              </View>
              <View className="flex-row flex-wrap gap-x-5 gap-y-1 pt-3 border-t border-line">
                <Text className="text-ink text-sm">Transfer: {trip.route_summary.transfers}x</Text>
                <Text className="text-ink text-sm">Jalan kaki: {trip.route_summary.walking_distance_m} m</Text>
                <Text className="text-ink text-sm" weight="bold">
                  Tarif: {formatRupiah(trip.fare_total)}
                </Text>
                {trip.co2_estimate_g != null && (
                  <Pressable onPress={() => router.push("/co2-info")} accessibilityRole="link" hitSlop={6}>
                    <Text className="text-ink text-sm">
                      CO₂: ≈ {formatCo2(trip.co2_estimate_g)} <Text className="text-ink-2 text-sm underline">(estimasi)</Text>
                    </Text>
                  </Pressable>
                )}
              </View>
              <View className="gap-1.5 pt-3 border-t border-line">
                {(() => {
                  const display = durationDisplay({ basis: trip.duration_basis, actualMin: trip.actual_duration_min, predicted: trip.predicted_min_range });
                  return (
                    <>
                      <DurationBadge display={display} />
                      <Text className="text-ink-2 text-xs" style={{ lineHeight: 18 }}>
                        {durationNote(display)}
                      </Text>
                    </>
                  );
                })()}
              </View>
            </View>

            <View className="bg-surface rounded-2xl p-4 gap-3 border border-line">
              <Text className="text-ink text-base" weight="bold">
                Penilaian
              </Text>
              {trip.rating ? (
                <View className="gap-2">
                  <Stars value={trip.rating.stars} size={20} />
                  <Text className="text-ink text-sm">ETA sesuai: {ANSWER_LABEL(trip.rating.eta_accurate)}</Text>
                  <Text className="text-ink text-sm">Risiko transfer sesuai: {ANSWER_LABEL(trip.rating.transfer_risk_accurate)}</Text>
                  <Text className="text-ink text-sm">Kepadatan sesuai laporan: {ANSWER_LABEL(trip.rating.crowd_accurate)}</Text>
                  {trip.rating.message && (
                    <Text className="text-ink-2 text-sm" style={{ lineHeight: 20 }}>
                      “{trip.rating.message}”
                    </Text>
                  )}
                </View>
              ) : (
                <>
                  <Text className="text-ink-2 text-sm">Belum dinilai.</Text>
                  <PrimaryButton label="Beri penilaian" variant="outline" onPress={() => setRating(true)} />
                </>
              )}
            </View>

            {token && (
              <RatingSheet visible={rating} token={token} trip={trip} onClose={() => setRating(false)} onRated={setTrip} />
            )}
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

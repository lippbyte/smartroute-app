// Kartu "Riwayat Perjalanan" di Profil. Hari 1 Task 5: 3 perjalanan TERAKHIR
// dari GET /trips (sebelumnya 3 entri karangan: Bandung, Lebak Bulus, Monas).
// Tamu: ajakan masuk, tanpa panggilan ke server.
import { useAuth } from "@/context/AuthContext";
import { listTrips, type Trip } from "@/services/tripService";
import { formatTripDate } from "@/utils/tripFormat";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Text from "./Text";

function HistoryItem({ trip, showBorder, onPress }: { trip: Trip; showBorder: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.origin_label} ke ${trip.destination_label}. Ketuk untuk detail.`}
      className={`flex-row justify-between items-center py-3.5 active:opacity-60 ${showBorder ? "border-b border-line" : ""}`}
      style={{ minHeight: 48 }}
    >
      <View className="flex-1 mr-3 flex-row items-center gap-2">
        <Text className="text-ink-2 text-sm font-semibold flex-shrink" numberOfLines={1}>
          {trip.origin_label}
        </Text>
        <View style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: "#018959" }} />
        <Text className="text-ink-2 text-sm font-semibold flex-shrink" numberOfLines={1}>
          {trip.destination_label}
        </Text>
      </View>
      <Text className="text-ink-2 text-xs font-medium">{formatTripDate(trip.created_at).split(",").slice(0, 2).join(",")}</Text>
    </Pressable>
  );
}

export default function HistoryCard() {
  const router = useRouter();
  const { status, token } = useAuth();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let cancelled = false;
      listTrips(token)
        .then((list) => {
          if (!cancelled) {
            setTrips(list.slice(0, 3));
            setFailed(false);
          }
        })
        .catch(() => !cancelled && setFailed(true));
      return () => {
        cancelled = true;
      };
    }, [token]),
  );

  const signedIn = status === "signedIn" && !!token;

  return (
    <View className="bg-surface w-full px-5 py-4 rounded-2xl border border-line">
      <View className="w-full flex-row justify-between items-center">
        <Text className="text-ink font-bold text-lg mb-1">Riwayat Perjalanan</Text>
        <Pressable className="active:opacity-60 py-1.5" hitSlop={8} accessibilityRole="link" onPress={() => router.push("/history")}>
          <Text className="text-sm mb-1 underline" weight="semibold" style={{ color: "#0F3FC1" }}>
            Lihat Semua
          </Text>
        </Pressable>
      </View>

      {!signedIn ? (
        <Text className="text-ink-2 text-sm py-2">Masuk untuk menyimpan dan melihat riwayat perjalanan.</Text>
      ) : failed && !trips ? (
        <Text className="text-ink-2 text-sm py-2">Riwayat belum bisa dimuat. Buka "Lihat Semua" untuk mencoba lagi.</Text>
      ) : !trips ? (
        <View className="py-3 items-start">
          <ActivityIndicator size="small" color="#0F3FC1" />
        </View>
      ) : trips.length === 0 ? (
        <Text className="text-ink-2 text-sm py-2">Belum ada perjalanan. Perjalanan yang Anda selesaikan lewat navigasi akan muncul di sini.</Text>
      ) : (
        <View className="w-full">
          {trips.map((trip, index) => (
            <HistoryItem
              key={trip.id}
              trip={trip}
              showBorder={index !== trips.length - 1}
              onPress={() => router.push({ pathname: "/trip/[id]", params: { id: trip.id } })}
            />
          ))}
        </View>
      )}
    </View>
  );
}

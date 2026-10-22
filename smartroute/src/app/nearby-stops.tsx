import ScreenBackground from "@/components/ScreenBackground";
// src/app/nearby-stops.tsx
//
// Task App-15: layar "Halte Terdekat" — daftar halte/stasiun 4 moda
// (TransJakarta, JakLingko, MRT, LRT) terdekat dari lokasi GPS user, dari
// GET /nearby-stops (Task Backend-11). Perluasan (diminta user langsung,
// 2026-09-23): kini tersambung ke alur cari-rute — tiap halte punya aksi
// "Jalan ke sini" dan "Berangkat dari sini" (lihat utils/stopActions.ts).
import Text from "@/components/Text";
import StopActionButtons from "@/components/transit/StopActionButtons";
import {
  MODE_COLOR,
  MODE_ICON,
  MODE_LABEL,
  TransitMode,
  formatDistance,
} from "@/components/transit/transitMode";
import {
  NearbyStop,
  NearbyStopsFetchError,
  fetchNearbyStops,
} from "@/services/nearbyStopsService";
import { Coordinate } from "@/utils/geocode";
import { getCurrentCoordinate } from "@/utils/currentLocation";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";

// Radius awal (samakan dengan default backend, lihat services/nearbyStops.ts
// DEFAULT_RADIUS_M) dan tangga perluasan kalau hasil kosong — dibatasi ke
// MAX_RADIUS_M backend (routes/nearbyStops.ts), tidak ada gunanya minta
// lebih dari itu karena backend akan meng-cap-nya sendiri.
const INITIAL_RADIUS_M = 1500;
const EXPANDED_RADIUS_M = 5000;
// Pilihan radius yang bisa diketuk kapan saja (bukan cuma saat hasil kosong
// — dilaporkan user 23 Sep 2026: di Jababeka hasilnya 4 halte dalam 1,5 km,
// tapi tidak ada cara memperluas ke 5 km karena tombolnya cuma muncul kalau
// nol hasil).
const RADIUS_OPTIONS_M = [INITIAL_RADIUS_M, EXPANDED_RADIUS_M];

// __DEV__-only: fitur ini murni GPS-real (batasan eksplisit task — tidak ada
// data fiktif dikirim ke UI), jadi kalau device betulan berada di luar
// Jakarta, hasil normalnya memang kosong — itu bukan bug. Tapi untuk QA saat
// tester tidak sedang di Jakarta, sediakan simulasi lokasi TANPA mengubah
// setting GPS device (mock-location app, dsb). Titik-titik ini persis sama
// yang sudah live-diverifikasi lewat curl langsung ke backend di Task
// Backend-11 (Bundaran HI: 30 halte, mrt:1/jaklingko:17/transjakarta:12;
// Manggarai: termasuk LRT Proklamasi @731m) — dipilih supaya hasil simulasi
// bisa langsung dicocokkan ke angka yang sudah diketahui benar.
// __DEV__ true di Expo dev client, false di build production — blok ini
// (dan tombolnya) tidak pernah ikut ke build yang dirilis.
const DEV_TEST_LOCATIONS: { label: string; coordinate: Coordinate }[] = [
  { label: "Bundaran HI (uji)", coordinate: { latitude: -6.1918644, longitude: 106.8230084 } },
  { label: "Manggarai (uji)", coordinate: { latitude: -6.2086283, longitude: 106.8456205 } },
];

type LoadState =
  | { status: "loading" }
  | { status: "permission_denied" }
  | { status: "error"; message: string }
  | { status: "success"; stops: NearbyStop[]; radiusM: number; origin: Coordinate };

function ScreenHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-3 px-5 pt-14 pb-2">
      <Pressable
        onPress={() => router.back()}
        className="bg-surface p-3 rounded-full"
      >
        <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
      </Pressable>
      <Text className="text-white font-bold text-lg flex-1">{title}</Text>
      {/* Perluasan App-15 (diminta user langsung): pintasan ke peta SEMUA
          halte se-Jakarta — beda fitur dari list "terdekat dari saya" di
          layar ini (lihat all-stops-map.tsx), sengaja bukan navigasi rute. */}
      <Pressable
        onPress={() => router.push("/all-stops-map")}
        className="bg-surface flex-row items-center gap-1.5 px-3.5 py-3 rounded-full"
      >
        <Ionicons name="map-outline" size={16} color="#0A0A0A" />
        <Text className="text-ink font-bold text-xs">Peta</Text>
      </Pressable>
    </View>
  );
}

function ModeBadge({ mode }: { mode: TransitMode }) {
  return (
    <View
      className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ backgroundColor: `${MODE_COLOR[mode]}26` }}
    >
      <Ionicons name={MODE_ICON[mode]} size={13} color={MODE_COLOR[mode]} />
      <Text
        className="text-xs font-bold"
        style={{ color: MODE_COLOR[mode] }}
      >
        {MODE_LABEL[mode]}
      </Text>
    </View>
  );
}

function StopRow({
  stop,
  origin,
  expanded,
  onToggle,
  onOpenMap,
}: {
  stop: NearbyStop;
  origin: Coordinate;
  expanded: boolean;
  onToggle: () => void;
  onOpenMap: () => void;
}) {
  return (
    <View className="bg-surface rounded-2xl border border-line overflow-hidden">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Pilihan untuk ${stop.name}`}
        className="flex-row items-center gap-3 p-4 active:opacity-80"
      >
        <View
          className="p-2.5 rounded-xl"
          style={{ backgroundColor: `${MODE_COLOR[stop.mode]}26` }}
        >
          <Ionicons name={MODE_ICON[stop.mode]} size={20} color={MODE_COLOR[stop.mode]} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-ink font-bold text-md" numberOfLines={2}>
            {stop.name}
          </Text>
          <ModeBadge mode={stop.mode} />
        </View>
        <View className="items-end gap-1">
          <Text className="text-ink font-bold text-sm">
            {formatDistance(stop.distance_m)}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color="#737373"
          />
        </View>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 gap-2">
          <StopActionButtons stop={stop} userLocation={origin} />
          <Pressable
            onPress={onOpenMap}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-1.5 py-2 active:opacity-70"
          >
            <Ionicons name="map-outline" size={14} color="#737373" />
            <Text className="text-muted font-bold text-xs">Lihat di peta</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function NearbyStopsScreen() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Label lokasi uji yang sedang dipakai (null = GPS asli). Dipakai untuk
  // menandai chip yang aktif DAN memunculkan tombol kembali ke lokasi
  // sendiri — sebelumnya sekali menekan lokasi uji tidak ada jalan pulang
  // ke GPS asli selain membuka ulang layar (dilaporkan user).
  const [activeTestLabel, setActiveTestLabel] = useState<string | null>(null);
  // Satu baris terbuka sekaligus, dikunci pakai index karena nama+moda bisa
  // kembar (peron berbeda di halte yang sama).
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Koordinat terakhir yang benar-benar dipakai (GPS asli ATAU lokasi uji
  // __DEV__) — disimpan supaya "Perluas Radius" dan "Coba Lagi" pakai ulang
  // titik yang sama, bukan diam-diam kembali minta GPS asli (yang bisa beda
  // kalau tester sedang pakai lokasi uji karena berada di luar Jakarta).
  const lastCoordinateRef = useRef<Coordinate | null>(null);

  const loadAt = useCallback(async (coordinate: Coordinate, radiusM: number) => {
    lastCoordinateRef.current = coordinate;
    setExpandedIndex(null);
    setState({ status: "loading" });
    try {
      const stops = await fetchNearbyStops(
        coordinate.latitude,
        coordinate.longitude,
        radiusM,
      );
      setState({ status: "success", stops, radiusM, origin: coordinate });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof NearbyStopsFetchError || err instanceof Error
            ? err.message
            : "Gagal memuat daftar halte terdekat.",
      });
    }
  }, []);

  const loadFromGps = useCallback(
    async (radiusM: number) => {
      setActiveTestLabel(null);
      setState({ status: "loading" });
      const coordinate = await getCurrentCoordinate();
      if (!coordinate) {
        setState({ status: "permission_denied" });
        return;
      }
      await loadAt(coordinate, radiusM);
    },
    [loadAt],
  );

  // "Muat ulang" generik dipakai tombol Coba Lagi / Perluas Radius: kalau
  // sebelumnya sedang pakai lokasi uji, tetap di lokasi uji itu; kalau
  // belum ada koordinat sama sekali (baru pertama retry dari
  // permission_denied), minta GPS asli lagi.
  const reload = useCallback(
    (radiusM: number) => {
      if (lastCoordinateRef.current) {
        loadAt(lastCoordinateRef.current, radiusM);
      } else {
        loadFromGps(radiusM);
      }
    },
    [loadAt, loadFromGps],
  );

  useEffect(() => {
    loadFromGps(INITIAL_RADIUS_M);
  }, [loadFromGps]);

  const currentRadiusM =
    state.status === "success" ? state.radiusM : INITIAL_RADIUS_M;

  // Ketuk halte -> buka peta semua halte, langsung terbang ke titiknya
  // (perilaku sama dengan memilih hasil pencarian di peta itu).
  const openOnMap = (stop: NearbyStop) => {
    router.push({
      pathname: "/all-stops-map",
      params: {
        focusLat: String(stop.lat),
        focusLng: String(stop.lng),
        focusMode: stop.mode,
        focusName: stop.name,
        // Titik asal daftar ini (GPS asli ATAU lokasi uji) — peta menampilkan
        // posisi ini bersama halte yang dituju dalam satu bingkai.
        ...(lastCoordinateRef.current
          ? {
              fromLat: String(lastCoordinateRef.current.latitude),
              fromLng: String(lastCoordinateRef.current.longitude),
            }
          : {}),
      },
    });
  };

  return (
    <ScreenBackground>
      <ScreenHeader title="Halte Terdekat" />

      {/* __DEV__-only: lihat komentar DEV_TEST_LOCATIONS di atas — tidak
          pernah tampil di build production. */}
      {__DEV__ && (
        <View className="flex-row flex-wrap items-center gap-2 px-5 pb-3">
          {DEV_TEST_LOCATIONS.map((loc) => {
            const active = activeTestLabel === loc.label;
            return (
              <Pressable
                key={loc.label}
                onPress={() => {
                  setActiveTestLabel(loc.label);
                  loadAt(loc.coordinate, currentRadiusM);
                }}
                className={`border px-3 py-1.5 rounded-full ${
                  active
                    ? "bg-yellow-500 border-yellow-500"
                    : "bg-yellow-500/20 border-yellow-500/40"
                }`}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: active ? "#0A0A0A" : "#EAB308" }}
                >
                  🧪 {loc.label}
                </Text>
              </Pressable>
            );
          })}
          {/* Jalan pulang dari lokasi uji ke posisi GPS sebenarnya. */}
          {activeTestLabel !== null && (
            <Pressable
              onPress={() => loadFromGps(currentRadiusM)}
              accessibilityRole="button"
              accessibilityLabel="Kembali ke lokasi saya"
              className="bg-surface flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border border-line"
            >
              <Ionicons name="locate" size={13} color="#0A0A0A" />
              <Text className="text-ink text-xs font-bold">Lokasi saya</Text>
            </Pressable>
          )}
        </View>
      )}

      {state.status === "loading" ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#018959" />
          <Text className="text-surface-2 text-sm">Mencari lokasi & halte terdekat...</Text>
        </View>
      ) : state.status === "permission_denied" ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="location-outline" size={40} color="#737373" />
          <Text className="text-white text-center font-bold">
            Izin lokasi dibutuhkan
          </Text>
          <Text className="text-line text-center text-sm">
            Aktifkan izin lokasi untuk melihat halte terdekat dari posisimu
            saat ini.
          </Text>
          <Pressable
            onPress={() => reload(INITIAL_RADIUS_M)}
            className="bg-brand-blue px-5 py-2.5 rounded-xl mt-2"
          >
            <Text className="text-white font-bold">Coba Lagi</Text>
          </Pressable>
        </View>
      ) : state.status === "error" ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="warning-outline" size={40} color="#EF4444" />
          <Text className="text-white text-center font-bold">
            {state.message}
          </Text>
          <Pressable
            onPress={() => reload(INITIAL_RADIUS_M)}
            className="bg-brand-blue px-5 py-2.5 rounded-xl mt-2"
          >
            <Text className="text-white font-bold">Coba Lagi</Text>
          </Pressable>
        </View>
      ) : state.stops.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="navigate-outline" size={40} color="#737373" />
          <Text className="text-white text-center font-bold">
            Tidak ada halte dalam {formatDistance(state.radiusM)}
          </Text>
          {state.radiusM < EXPANDED_RADIUS_M && (
            <Pressable
              onPress={() => reload(EXPANDED_RADIUS_M)}
              className="bg-brand-blue px-5 py-2.5 rounded-xl mt-2"
            >
              <Text className="text-white font-bold">
                Perluas Radius ke {formatDistance(EXPANDED_RADIUS_M)}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={state.stops}
          keyExtractor={(item, index) => `${item.mode}-${item.name}-${index}`}
          extraData={expandedIndex}
          renderItem={({ item, index }) => (
            <StopRow
              stop={item}
              origin={state.origin}
              expanded={expandedIndex === index}
              onToggle={() => setExpandedIndex((cur) => (cur === index ? null : index))}
              onOpenMap={() => openOnMap(item)}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerClassName="px-5 pb-10 pt-2"
          ListHeaderComponent={
            <View className="gap-2.5 mb-3">
              <Text className="text-line text-sm">
                {state.stops.length} halte dalam radius{" "}
                {formatDistance(state.radiusM)} · ketuk halte untuk jalan ke
                sana atau berangkat dari sana
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-line text-xs">Radius</Text>
                {RADIUS_OPTIONS_M.map((radius) => {
                  const active = state.radiusM === radius;
                  return (
                    <Pressable
                      key={radius}
                      onPress={() => reload(radius)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Radius ${formatDistance(radius)}`}
                      className={`${active ? "bg-brand-blue" : "bg-surface"} px-3 py-1.5 rounded-full border border-line`}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: active ? "#FFFFFF" : "#0A0A0A" }}
                      >
                        {formatDistance(radius)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          }
        />
      )}
    </ScreenBackground>
  );
}

// src/app/(tabs)/route/index.tsx
//
// Task App-12: dipindah dari (tabs)/route.tsx (isi tidak berubah) — supaya
// jadi root screen di dalam Stack milik route/_layout.tsx, bukan flat
// sibling dengan route/[id].tsx di dalam Tabs navigator. Lihat komentar di
// route/_layout.tsx untuk alasan lengkapnya.
import ScreenBackground from "@/components/ScreenBackground";
import Text from "@/components/Text";
import TopNav from "@/components/TopNav";
import {
  adaptToLegacyShape,
  fetchRealRoutes,
  RouteFetchError,
} from "@/services/routeService";
import { putRoute } from "@/services/routeStore";
import { ApiResponse, RouteItem } from "@/type";
import { formatRupiah } from "@/utils/currency";
import { formatDepartureLabel } from "@/utils/departureTime";
import { geocodePlace, shortPlaceLabel } from "@/utils/geocode";
import { parseCoordParam } from "@/utils/stopActions";
import { Ionicons } from "@expo/vector-icons";
import { legModeStyle, MODE_FILTERS } from "@/components/transit/legModes";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";

// Helper untuk menentukan label tipe berdasarkan karakteristik rute.
// recommendation_score/crowd bisa undefined (backend belum mengisinya —
// lihat TEMPORARY SHIM di src/services/routeService.ts), jadi jangan
// diakses langsung.
const getRouteTypeLabel = (item: RouteItem): string => {
  if ((item.recommendation_score ?? 0) >= 0.9) return "Rekomendasi";
  if (item.travel_time_minutes <= 30) return "Cepat";
  if (item.cost_idr <= 4000) return "Murah";
  if (item.crowd?.predicted_level === "LOW") return "Tenang";
  return "Nyaman";
};

// "Bogor Line" / "Lin Utara-Selatan" terlalu panjang untuk badge kartu;
// nomor rute bus sudah pendek.
const shortServiceName = (service: string) =>
  service.length > 10 ? service.replace(/\s*Line$/i, "").slice(0, 12) : service;

const formatClock = (iso?: string) => {
  if (!iso) return null;
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
};

const getModeIcon = (mode: string) => {
  const style = legModeStyle(mode);
  return <Ionicons name={style.icon} size={18} color={style.color} />;
};

const RouteOptionCard = ({
  item,
  originName,
  destinationName,
}: {
  item: RouteItem;
  originName: string;
  destinationName: string;
}) => {
  const router = useRouter();
  const typeLabel = getRouteTypeLabel(item);
  const startClock = formatClock(item.legs[0]?.depart_at);
  const endClock = formatClock(item.legs[item.legs.length - 1]?.arrive_at);

  // Skor rekomendasi belum tentu ada (lihat komentar di atas) — kalau
  // undefined, jangan tampilkan angka/warna dari data yang tidak ada.
  const score10 =
    item.recommendation_score != null
      ? Math.round(item.recommendation_score * 10)
      : null;
  const scoreColor =
    score10 == null
      ? "text-muted"
      : score10 >= 8
        ? "text-primary-emerald"
        : score10 >= 6
          ? "text-yellow-400"
          : "text-accent";

  return (
    <Pressable
      onPress={() => {
        // Rute dibawa lewat routeStore, bukan JSON di URL — lihat
        // services/routeStore.ts.
        putRoute({ route: item, originName, destinationName });
        router.push({ pathname: "/route/[id]", params: { id: item.route_id } });
      }}
      className="bg-surface px-4 py-4 gap-3 rounded-xl active:opacity-95 border border-line"
    >
      <View className="flex-row justify-between items-center">
        <Text className="bg-surface-2 font-bold text-ink text-xs px-2.5 py-1 rounded-md capitalize border border-line">
          {typeLabel}
        </Text>
        {item.crowd?.predicted_level === "HIGH" && (
          <View className="flex-row items-center gap-1 bg-red-500/20 px-2 py-0.5 rounded">
            <Ionicons name="people" size={12} color="#EF4444" />
            <Text className="text-red-400 text-[10px] font-bold">PADAT</Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center justify-between">
        {/* Ala Google Maps: ikon moda + nomor rute/koridor tiap leg transit.
            Leg jalan kaki pendek cuma ikon. */}
        <View className="flex-row gap-1 items-center flex-1 flex-wrap pr-2">
          {item.legs.map((leg, index) => {
            const isLast = index === item.legs.length - 1;
            const style = legModeStyle(leg.mode);
            const isWalk = leg.mode.toLowerCase() === "walk";
            return (
              <View key={index} className="flex-row items-center gap-1">
                {isWalk ? (
                  getModeIcon(leg.mode)
                ) : (
                  <View
                    className="flex-row items-center gap-1 px-1.5 py-0.5 rounded-md"
                    style={{ backgroundColor: `${style.color}26` }}
                  >
                    <Ionicons name={style.icon} size={14} color={style.color} />
                    {leg.service && (
                      <Text
                        className="text-[11px] font-bold"
                        style={{ color: "#0A0A0A" }}
                        numberOfLines={1}
                      >
                        {shortServiceName(leg.service)}
                      </Text>
                    )}
                  </View>
                )}
                {!isLast && (
                  <Ionicons name="chevron-forward" size={12} color="#A3A3A3" />
                )}
              </View>
            );
          })}
        </View>
        {score10 != null ? (
          <Text className={`font-bold text-xl ${scoreColor}`}>
            {score10}
            <Text className="text-sm text-muted">/10</Text>
          </Text>
        ) : (
          <Text className="text-xs text-muted">Skor belum tersedia</Text>
        )}
      </View>

      <View className="flex-row justify-between items-center gap-3 pt-1 border-t border-line">
        <View className="flex-1 flex-row flex-wrap gap-x-3 gap-y-1">
          <View className="flex-row items-center gap-1">
            <Ionicons name="time-outline" size={14} color="#737373" />
            <Text className="text-xs text-ink-2">
              {item.travel_time_minutes} mnt
              {startClock && endClock ? ` · ${startClock}–${endClock}` : ""}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="swap-horizontal" size={14} color="#737373" />
            <Text className="text-xs text-ink-2">
              {item.transfers}x transit
            </Text>
          </View>
        </View>
        <Text className="text-sm font-semibold text-ink shrink-0" numberOfLines={1}>
          {formatRupiah(item.cost_idr)}
        </Text>
      </View>
    </Pressable>
  );
};

const CRITERIA = ["Semua", "Rekomendasi", "Cepat", "Murah", "Tenang"];

// Backend mengembalikan maksimal 4 kandidat (MAX_CANDIDATES); batas di sini
// menjaga layar tetap 4 opsi walau backend berubah.
const MAX_VISIBLE_ROUTES = 4;

// "lat,lng" dari Beranda (koordinat pasti saran yang di-tap / GPS / Tujuan
// Cepat) — lihat PickedPlace di (tabs)/index.tsx.
// Chip pilihan di lembar Filter. Warna teks lewat style, bukan className: di
// web, class Text yang berganti ditumpuk (text-white + text-ink-2
// sekaligus), jadi chip yang aktif lagi bisa berteks pucat di atas latar
// putih.
function FilterChip({
  label,
  active,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      className={`${active ? "bg-brand-blue" : "bg-surface-2"} flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border border-line`}
    >
      {icon && (
        <Ionicons name={icon} size={14} color={active ? "#FFFFFF" : "#404040"} />
      )}
      <Text
        className="font-semibold text-xs"
        style={{ color: active ? "#FFFFFF" : "#404040" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Lembar filter dari bawah: moda (cari ulang ke backend) + kriteria (saring
// kandidat yang sudah ada) — sebelumnya dua baris chip terpisah di layar.
// Pilihan baru berlaku setelah "Terapkan", supaya ganti moda tidak langsung
// memicu pencarian ulang tiap tap.
function FilterSheet({
  visible,
  modeKey,
  criteria,
  onClose,
  onApply,
}: {
  visible: boolean;
  modeKey: string;
  criteria: string;
  onClose: () => void;
  onApply: (modeKey: string, criteria: string) => void;
}) {
  const [draftMode, setDraftMode] = useState(modeKey);
  const [draftCriteria, setDraftCriteria] = useState(criteria);

  useEffect(() => {
    if (visible) {
      setDraftMode(modeKey);
      setDraftCriteria(criteria);
    }
  }, [visible, modeKey, criteria]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 bg-black/60"
        onPress={onClose}
        accessibilityLabel="Tutup filter"
      />
      <View className="bg-surface rounded-t-3xl px-5 pt-3 pb-8 gap-5 border-t border-line">
        <View className="items-center">
          <View className="w-10 h-1 rounded-full bg-line" />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-ink font-bold text-lg">Filter Rute</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Tutup">
            <Ionicons name="close" size={22} color="#737373" />
          </Pressable>
        </View>

        <View className="gap-2.5">
          <Text className="text-ink-2 text-sm font-semibold">Moda transportasi</Text>
          <View className="flex-row flex-wrap gap-2">
            {MODE_FILTERS.map((m) => (
              <FilterChip
                key={m.key}
                label={m.label}
                icon={m.icon}
                active={draftMode === m.key}
                onPress={() => setDraftMode(m.key)}
                accessibilityLabel={`Tampilkan rute ${m.label}`}
              />
            ))}
          </View>
          <Text className="text-muted text-xs">
            Memilih satu moda mencari ulang rute yang hanya memakai moda itu
            (plus jalan kaki).
          </Text>
        </View>

        <View className="gap-2.5">
          <Text className="text-ink-2 text-sm font-semibold">Prioritas</Text>
          <View className="flex-row flex-wrap gap-2">
            {CRITERIA.map((c) => (
              <FilterChip
                key={c}
                label={c}
                active={draftCriteria === c}
                onPress={() => setDraftCriteria(c)}
              />
            ))}
          </View>
        </View>

        <View className="flex-row gap-3 pt-1">
          <Pressable
            onPress={() => {
              setDraftMode(MODE_FILTERS[0].key);
              setDraftCriteria(CRITERIA[0]);
            }}
            className="flex-1 py-3.5 rounded-xl items-center bg-surface-2 border border-line"
          >
            <Text className="text-ink font-semibold text-sm">Reset</Text>
          </Pressable>
          <Pressable
            onPress={() => onApply(draftMode, draftCriteria)}
            className="flex-[2] py-3.5 rounded-xl items-center bg-[#018959]"
          >
            <Text className="font-bold text-sm" style={{ color: "#FFFFFF" }}>
              Terapkan
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function RouteScreen() {
  const router = useRouter();
  // Diisi lewat router.push dari layar Beranda (index.tsx) setelah user
  // mengisi asal & tujuan nyata. Tab "Rute" juga bisa dibuka langsung dari
  // tab bar tanpa params ini — ditangani sebagai state kosong di bawah,
  // bukan fallback ke mock.
  const {
    origin: originParam,
    destination: destinationParam,
    originCoord: originCoordParam,
    destinationCoord: destinationCoordParam,
    // Task App-08: ISO 8601 dengan offset (dibangun di index.tsx lewat
    // buildDepartureTimeIso), atau undefined kalau user tidak mengaktifkan
    // "Atur waktu" — diteruskan apa adanya ke fetchRealRoutes di bawah.
    departureTime: departureTimeParam,
  } = useLocalSearchParams<{
    origin?: string;
    destination?: string;
    originCoord?: string;
    destinationCoord?: string;
    departureTime?: string;
  }>();

  const [selectedFilter, setSelectedFilter] = useState(CRITERIA[0]);
  const [modeKey, setModeKey] = useState(MODE_FILTERS[0].key);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const modeFilter = MODE_FILTERS.find((m) => m.key === modeKey) ?? MODE_FILTERS[0];
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const originLabel = originParam ? shortPlaceLabel(originParam) : undefined;
  const destinationLabel = destinationParam
    ? shortPlaceLabel(destinationParam)
    : undefined;

  useEffect(() => {
    if (!originParam || !destinationParam) return;

    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setApiResponse(null);
      try {
        // Koordinat pasti dari Beranda dulu; teks baru di-geocode kalau user
        // mengetik tanpa memilih saran.
        const [originCoord, destCoord] = await Promise.all([
          parseCoordParam(originCoordParam) ?? geocodePlace(originParam),
          parseCoordParam(destinationCoordParam) ?? geocodePlace(destinationParam),
        ]);
        if (!originCoord || !destCoord) {
          throw new Error(
            `Tidak bisa menemukan koordinat untuk "${
              !originCoord ? originParam : destinationParam
            }". Coba pilih salah satu saran lokasi saat mengetik.`,
          );
        }

        // fetchRealRoutes + adaptToLegacyShape menggantikan mockApiResponse
        // (Task Integration-01) — lihat src/services/routeService.ts.
        const recommendation = await fetchRealRoutes(
          { lat: originCoord.latitude, lng: originCoord.longitude },
          { lat: destCoord.latitude, lng: destCoord.longitude },
          departureTimeParam,
          modeFilter.backendModes,
        );
        if (cancelled) return;
        setApiResponse(
          adaptToLegacyShape(recommendation, {
            origin: originLabel,
            destination: destinationLabel,
          }),
        );
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof RouteFetchError || err instanceof Error
            ? err.message
            : "Gagal memuat rute dari backend.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // modeFilter berubah hanya lewat modeKey — cukup modeKey di daftar ini.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    originParam,
    destinationParam,
    originCoordParam,
    destinationCoordParam,
    departureTimeParam,
    modeKey,
  ]);

  const filteredRoutes = (apiResponse?.routes ?? [])
    .filter((item) => {
      if (selectedFilter === "Semua") return true;
      return getRouteTypeLabel(item) === selectedFilter;
    })
    // Backend sudah mengembalikan `routes` terurut dari yang paling
    // relevan berdasarkan recommendation_score-nya sendiri (lihat `rank`
    // di adaptToLegacyShape) — tidak disortir ulang di sini secara
    // terpisah supaya urutannya konsisten dengan yang dihitung backend.
    .slice()
    .sort((a, b) => a.rank - b.rank);

  // Task App-20: waktu berangkat yang BENAR-BENAR dipakai backend untuk
  // hitung jadwal rute ini — sama untuk semua kandidat di bawah, jadi
  // ditampilkan sekali di header, bukan diulang tiap kartu.
  const departureLabel = apiResponse?.departure_time
    ? formatDepartureLabel(apiResponse.departure_time)
    : null;

  const activeFilterLabels = [
    modeKey !== MODE_FILTERS[0].key ? modeFilter.label : null,
    selectedFilter !== CRITERIA[0] ? selectedFilter : null,
  ].filter((x): x is string => x !== null);

  return (
    <ScreenBackground>
      {/* Header (judul, asal-tujuan, Filter) tetap di tempat; hanya daftar
          rute di bawahnya yang di-scroll. */}
      <View className="px-5 pt-12 pb-3 gap-3">
          <TopNav />
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
              accessibilityRole="button"
              accessibilityLabel="Kembali"
              className="bg-surface p-2.5 rounded-full border border-line"
            >
              <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
            </Pressable>
            <Text className="text-2xl font-bold text-white">Hasil Rute</Text>
          </View>

          {originLabel && destinationLabel && (
            // Asal & tujuan sebagai dua baris ala Google Maps — nama tempat
            // yang dipilih user, bukan koordinat dari backend.
            <View className="bg-surface rounded-xl px-4 py-3 gap-2 border border-line">
              <View className="flex-row items-center gap-3">
                <View className="w-2.5 h-2.5 rounded-full border-2 border-ink" />
                <Text className="text-ink text-sm flex-1" numberOfLines={1}>
                  {originLabel}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Ionicons name="location" size={12} color="#EF4444" />
                <Text className="text-ink text-sm flex-1" numberOfLines={1}>
                  {destinationLabel}
                </Text>
              </View>
            </View>
          )}

          {originParam && destinationParam && (
            // Di luar percabangan loading/error/kosong di bawah: kalau satu
            // moda tidak menghasilkan rute, filter harus tetap bisa dibuka
            // untuk kembali, bukan ikut hilang bersama daftar hasil.
            <View className="flex-row items-center gap-2 flex-wrap">
              <Pressable
                onPress={() => setIsFilterOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Buka filter rute"
                className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border ${
                  activeFilterLabels.length
                    ? "bg-brand-blue border-brand-blue"
                    : "bg-surface border-line"
                }`}
              >
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={activeFilterLabels.length ? "#FFFFFF" : "#0A0A0A"}
                />
                <Text
                  className="font-semibold text-xs"
                  style={{ color: activeFilterLabels.length ? "#FFFFFF" : "#0A0A0A" }}
                >
                  Filter
                  {activeFilterLabels.length ? ` (${activeFilterLabels.length})` : ""}
                </Text>
              </Pressable>
              {activeFilterLabels.map((label) => (
                <View
                  key={label}
                  className="px-3 py-2 rounded-full bg-surface border border-line"
                >
                  <Text className="text-xs" style={{ color: "#404040" }}>
                    {label}
                  </Text>
                </View>
              ))}
              {departureLabel && (
                <View className="flex-row items-center gap-1 ml-auto">
                  <Ionicons name="time-outline" size={13} color="#737373" />
                  <Text className="text-muted text-xs">
                    Berangkat {departureLabel}
                  </Text>
                </View>
              )}
            </View>
          )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-2 pb-32 gap-3"
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        scrollEventThrottle={16}
      >
        {!originParam || !destinationParam ? (
          <View className="items-center gap-3 py-10 px-4">
            <Ionicons name="search-outline" size={32} color="#737373" />
            <Text className="text-surface-2 text-sm text-center">
              Belum ada pencarian rute. Isi asal & tujuan di halaman Beranda
              dulu.
            </Text>
          </View>
        ) : isLoading ? (
          <View className="items-center gap-3 py-10">
            <ActivityIndicator size="large" color="#018959" />
            <Text className="text-surface-2 text-sm">
              Mencari rute dari backend...
            </Text>
          </View>
        ) : errorMessage ? (
          <View className="items-center gap-3 py-10 px-4">
            <Ionicons name="warning-outline" size={32} color="#EF4444" />
            <Text className="text-white text-sm text-center">
              {errorMessage}
            </Text>
          </View>
        ) : apiResponse && apiResponse.routes.length === 0 ? (
          <View className="items-center gap-3 py-10 px-4">
            <Ionicons name="alert-circle-outline" size={32} color="#737373" />
            <Text className="text-surface-2 text-sm text-center">
              {modeFilter.backendModes
                ? `Tidak ada rute yang hanya memakai ${modeFilter.label} untuk perjalanan ini. Pilih "Semua moda" di Filter untuk melihat rute gabungan.`
                : "Tidak ada rute yang ditemukan untuk perjalanan ini."}
            </Text>
          </View>
        ) : filteredRoutes.length === 0 ? (
          <View className="items-center gap-3 py-10 px-4">
            <Ionicons name="funnel-outline" size={32} color="#737373" />
            <Text className="text-surface-2 text-sm text-center">
              Tidak ada rute berlabel &quot;{selectedFilter}&quot;. Ubah
              prioritas di Filter.
            </Text>
          </View>
        ) : (
          // Maksimal 4 opsi. Kartu masuk bergantian (fade + naik sedikit,
          // pegas lembut); key memuat moda supaya animasi diputar ulang
          // setiap hasil filter baru datang.
          filteredRoutes.slice(0, MAX_VISIBLE_ROUTES).map((item, index) => (
            <Animated.View
              key={`${modeKey}-${item.route_id}`}
              entering={FadeInDown.delay(index * 80)
                .duration(380)
                .springify()
                .damping(18)}
              layout={LinearTransition.springify().damping(18)}
            >
              <RouteOptionCard
                item={item}
                originName={apiResponse!.origin.name}
                destinationName={apiResponse!.destination.name}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>

      <FilterSheet
        visible={isFilterOpen}
        modeKey={modeKey}
        criteria={selectedFilter}
        onClose={() => setIsFilterOpen(false)}
        onApply={(nextMode, nextCriteria) => {
          setIsFilterOpen(false);
          setModeKey(nextMode);
          setSelectedFilter(nextCriteria);
        }}
      />
    </ScreenBackground>
  );
}

// src/app/all-stops-map.tsx
//
// Perluasan dari Task App-15 (diminta user langsung, bukan dari task file
// tertulis): peta SEMUA halte/stasiun 4 moda se-Jakarta (bisa ribuan titik),
// dari GET /all-stops (backend/backend-skeleton/src/routes/allStops.ts).
// BEDA dari nearby-stops.tsx: layar itu selalu berbasis "terdekat dari GPS
// saya" (maks 30 titik, radius 1.5-5km) — layar ini gambaran keseluruhan
// cakupan transit se-Jakarta; GPS cuma dipakai untuk menandai posisi user
// di peta (opsional, peta tetap jalan kalau izin ditolak). Fitur
// informasi berdiri sendiri juga (sama batasan App-15) — tidak menyentuh
// alur cari-rute.
import Text from "@/components/Text";
import AllStopsMapView from "@/components/transit/AllStopsMapView";
import type { AllStopsMapViewHandle } from "@/components/transit/allStopsMapTypes";
import {
  MODE_COLOR,
  MODE_ICON,
  MODE_LABEL,
  TransitMode,
} from "@/components/transit/transitMode";
import {
  NearbyStopsFetchError,
  TransitStop,
  fetchAllStops,
} from "@/services/nearbyStopsService";
import { getCurrentCoordinate } from "@/utils/currentLocation";
import { Coordinate } from "@/utils/geocode";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

const ALL_MODES: TransitMode[] = ["transjakarta", "jaklingko", "mrt", "lrt"];
const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_RESULTS = 20;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; stops: TransitStop[] };

function ScreenHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View className="absolute top-14 left-5 right-5 flex-row items-center gap-3 z-10">
      <Pressable
        onPress={() => router.back()}
        className="bg-surface p-3 rounded-full shadow-md"
      >
        <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
      </Pressable>
      <View className="bg-surface/95 px-4 py-2.5 rounded-full">
        <Text className="text-ink font-bold text-sm">{title}</Text>
      </View>
    </View>
  );
}

function ModeToggleChip({
  mode,
  count,
  active,
  onToggle,
}: {
  mode: TransitMode;
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center gap-1.5 px-3 py-2 rounded-full"
      style={{
        backgroundColor: active ? `${MODE_COLOR[mode]}33` : "rgba(39, 39, 42, 0.95)",
        borderWidth: 1,
        borderColor: active ? MODE_COLOR[mode] : "rgba(161, 161, 170, 0.3)",
      }}
    >
      <Ionicons
        name={MODE_ICON[mode]}
        size={14}
        color={active ? MODE_COLOR[mode] : "#737373"}
      />
      <Text
        className="text-xs font-bold"
        style={{ color: active ? MODE_COLOR[mode] : "#737373" }}
      >
        {MODE_LABEL[mode]} ({count})
      </Text>
    </Pressable>
  );
}

function SearchResultRow({
  stop,
  onPress,
}: {
  stop: TransitStop;
  onPress: () => void;
}) {
  return (
    <Pressable
      // onPressIn, bukan onPress: di HP jeda antara jari menyentuh dan
      // melepas bisa lebih lama dari timer blur field pencarian, sehingga
      // baris ini keburu hilang dan pilihan tidak pernah terbaca — peta
      // lalu terlihat "tidak mengarah ke halte" (dilaporkan 23 Sep 2026).
      // Sama dengan perbaikan di LocationAutocompleteField.
      onPressIn={onPress}
      onPress={() => {}}
      className="flex-row items-center gap-2.5 px-4 py-3 active:bg-surface-2 border-b border-line last:border-b-0"
    >
      <Ionicons name={MODE_ICON[stop.mode]} size={16} color={MODE_COLOR[stop.mode]} />
      <View className="flex-1">
        <Text className="text-ink font-bold text-sm" numberOfLines={1}>
          {stop.name}
        </Text>
      </View>
      <Text className="text-xs font-bold" style={{ color: MODE_COLOR[stop.mode] }}>
        {MODE_LABEL[stop.mode]}
      </Text>
    </Pressable>
  );
}

export default function AllStopsMapScreen() {
  // Diisi kalau layar ini dibuka dari daftar "Halte Terdekat" (ketuk salah
  // satu halte) — lihat efek fokus di bawah.
  const { focusLat, focusLng, focusMode, focusName, fromLat, fromLng } = useLocalSearchParams<{
    focusLat?: string;
    focusLng?: string;
    fromLat?: string;
    fromLng?: string;
    focusMode?: string;
    focusName?: string;
  }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Default: JakLingko dimatikan — 7215 dari 7829 titik total (lihat
  // Task Backend-09/App-15), langsung tampil semua sejak awal bikin peta
  // penuh sesak dan susah dibaca 3 moda lain yang jauh lebih jarang. User
  // tinggal tap chip JakLingko kalau memang mau lihat cakupannya.
  const [activeModes, setActiveModes] = useState<Set<TransitMode>>(
    () => new Set(ALL_MODES.filter((m) => m !== "jaklingko")),
  );

  const mapRef = useRef<AllStopsMapViewHandle>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [chipsHeight, setChipsHeight] = useState(0);
  // Sama alasan dengan blurTimeoutRef di LocationAutocompleteField.tsx: tap
  // di baris hasil menyentuh layar sebelum TextInput sempat blur, jadi blur
  // ditunda dikit supaya onPress sempat kebaca duluan.
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const stops = await fetchAllStops();
      setState({ status: "success", stops });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof NearbyStopsFetchError || err instanceof Error
            ? err.message
            : "Gagal memuat data halte.",
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countByMode = useMemo(() => {
    const counts: Record<TransitMode, number> = {
      transjakarta: 0,
      jaklingko: 0,
      mrt: 0,
      lrt: 0,
    };
    if (state.status === "success") {
      for (const stop of state.stops) counts[stop.mode]++;
    }
    return counts;
  }, [state]);

  const filteredStops = useMemo(() => {
    if (state.status !== "success") return [];
    return state.stops.filter((s) => activeModes.has(s.mode));
  }, [state, activeModes]);

  const toggleMode = (mode: TransitMode) => {
    setActiveModes((current) => {
      const next = new Set(current);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  };

  // Cari lintas SEMUA moda (state.stops, bukan filteredStops) — user harus
  // tetap bisa menemukan halte JakLingko lewat cari walau chip-nya lagi
  // mati; handleSelectResult di bawah yang menyalakan moda itu otomatis
  // begitu dipilih, supaya hasilnya benar-benar kelihatan di peta.
  const trimmedQuery = searchQuery.trim();
  const searchResults = useMemo(() => {
    if (state.status !== "success" || trimmedQuery.length < MIN_SEARCH_LENGTH) return [];
    const needle = trimmedQuery.toLowerCase();
    // BUG (dilaporkan user: cari "bundaran" cuma memunculkan JakLingko):
    // dulu hasil dipotong 8 teratas sesuai URUTAN DATA, dan titik JakLingko
    // (7215 dari 7838) hampir selalu memenuhi kuota lebih dulu — "Bundaran
    // HI" (MRT) & "Bundaran HI Astra" (TransJakarta) yang ada di data tidak
    // pernah kebagian slot. Sekarang diurutkan dulu: yang namanya PERSIS/
    // berawalan kata kunci menang, lalu halte besar (BRT/MRT/LRT) sebelum
    // titik mikrotrans, baru nama terpendek. Peron duplikat (nama+moda sama)
    // dibuang supaya satu halte tidak memakan banyak baris.
    const matchRank = (name: string) => {
      const n = name.toLowerCase();
      if (n === needle) return 0;
      if (n.startsWith(needle)) return 1;
      if (n.split(/\s+/).some((w) => w.startsWith(needle))) return 2;
      return 3;
    };
    const modeRank: Record<TransitMode, number> = {
      transjakarta: 0,
      mrt: 0,
      lrt: 0,
      jaklingko: 1,
    };
    const seen = new Set<string>();
    return state.stops
      .filter((s) => s.name.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          matchRank(a.name) - matchRank(b.name) ||
          modeRank[a.mode] - modeRank[b.mode] ||
          a.name.length - b.name.length ||
          a.name.localeCompare(b.name),
      )
      .filter((s) => {
        const key = `${s.mode}|${s.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_SEARCH_RESULTS);
  }, [state, trimmedQuery]);

  const clearBlurTimeout = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  // BUG (ditemukan dari laporan user — "halte tidak langsung muncul" setelah
  // cari): handleSelectResult LAMA memanggil mapRef.flyTo() di baris yang
  // sama dengan setActiveModes(...). setState di React tidak langsung
  // mengubah props — AllStopsMapView masih menerima `stops` versi LAMA
  // (belum termasuk moda yang baru dinyalakan) di saat kamera sudah mulai
  // terbang ke sana, jadi kamera sampai duluan sebelum titik targetnya ada
  // di peta. Diperbaiki dengan menyimpan target di state, dan baru
  // memanggil flyTo lewat useEffect SETELAH activeModes benar-benar berisi
  // moda itu (yang berarti filteredStops/geojson di AllStopsMapView sudah
  // ikut re-render dengan titik yang dicari).
  // mode kosong = bukan halte (mis. posisi GPS user), tidak perlu menunggu
  // chip moda mana pun menyala.
  const [pendingFlyTarget, setPendingFlyTarget] = useState<{
    lat: number;
    lng: number;
    mode?: TransitMode;
    zoom?: number;
  } | null>(null);

  useEffect(() => {
    if (!pendingFlyTarget) return;
    if (pendingFlyTarget.mode && !activeModes.has(pendingFlyTarget.mode)) return;
    // Peta bisa saja belum selesai dipasang saat target datang dari layar
    // lain (lihat efek fokus di bawah) — ref-nya masih null. Dicoba ulang
    // beberapa kali, bukan sekali lalu menyerah diam-diam.
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      if (mapRef.current) {
        mapRef.current.flyTo(
          { lat: pendingFlyTarget.lat, lng: pendingFlyTarget.lng },
          pendingFlyTarget.zoom ?? 17,
        );
        setPendingFlyTarget(null);
        return;
      }
      if (++tries < 10) timer = setTimeout(attempt, 300);
    };
    timer = setTimeout(attempt, 0);
    return () => clearTimeout(timer);
  }, [pendingFlyTarget, activeModes]);

  // Dibuka dari layar "Halte Terdekat" dengan satu halte yang dituju: begitu
  // data halte siap, nyalakan modanya lalu terbang ke titiknya — sama persis
  // dengan memilih hasil pencarian di layar ini.
  // Titik asal dari layar Halte Terdekat (GPS asli atau lokasi uji yang
  // sedang dipakai di sana). Kalau ada, inilah "lokasi saya" di peta ini —
  // bukan GPS dibaca ulang, supaya konsisten dengan daftar yang barusan
  // dilihat user.
  const originFromParams = useMemo<Coordinate | null>(() => {
    const la = Number(fromLat);
    const ln = Number(fromLng);
    return fromLat && fromLng && Number.isFinite(la) && Number.isFinite(ln)
      ? { latitude: la, longitude: ln }
      : null;
  }, [fromLat, fromLng]);

  const focusHandledRef = useRef(false);
  const [showFocusBanner, setShowFocusBanner] = useState(true);
  useEffect(() => {
    if (focusHandledRef.current || state.status !== "success") return;
    const lat = Number(focusLat);
    const lng = Number(focusLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const mode = ALL_MODES.includes(focusMode as TransitMode)
      ? (focusMode as TransitMode)
      : "transjakarta";
    focusHandledRef.current = true;
    setActiveModes((current) => {
      if (current.has(mode)) return current;
      const next = new Set(current);
      next.add(mode);
      return next;
    });
    // Lokasi user (dari layar Halte Terdekat) ikut masuk bingkai: kamera
    // diarahkan ke titik tengah keduanya dengan zoom sesuai jaraknya, bukan
    // zoom dekat ke halte saja yang membuat titik "saya" keluar layar.
    const from = originFromParams;
    if (from) {
      const dLat = (lat - from.latitude) * 111_000;
      const dLng = (lng - from.longitude) * 110_000;
      const dist = Math.max(150, Math.hypot(dLat, dLng));
      const zoom = Math.min(17, Math.max(11, 16.5 - Math.log2(dist / 150)));
      setPendingFlyTarget({
        lat: (lat + from.latitude) / 2,
        lng: (lng + from.longitude) / 2,
        mode,
        zoom,
      });
    } else {
      setPendingFlyTarget({ lat, lng, mode });
    }
  }, [state.status, focusLat, focusLng, focusMode, originFromParams]);

  const [userLocation, setUserLocation] = useState<Coordinate | null>(
    () => originFromParams,
  );
  const [isLocating, setIsLocating] = useState(false);

  const locateUser = useCallback(async () => {
    setIsLocating(true);
    const coordinate = await getCurrentCoordinate();
    setIsLocating(false);
    if (coordinate) setUserLocation(coordinate);
    return coordinate;
  }, []);

  useEffect(() => {
    // Sudah punya titik asal dari Halte Terdekat -> jangan ditimpa GPS
    // (bisa beda kalau di sana sedang pakai lokasi uji). Tombol lokasi
    // tetap bisa dipakai untuk membaca GPS asli.
    if (originFromParams) return;
    locateUser();
  }, [locateUser, originFromParams]);

  // Sekali saja saat GPS pertama terbaca, dan tidak kalau layar dibuka untuk
  // fokus ke satu halte (dari "Halte Terdekat") — itu yang lebih penting.
  const autoCenteredRef = useRef(false);
  useEffect(() => {
    if (autoCenteredRef.current || state.status !== "success" || !userLocation) return;
    autoCenteredRef.current = true;
    if (focusLat && focusLng) return;
    setPendingFlyTarget({ lat: userLocation.latitude, lng: userLocation.longitude, zoom: 15 });
  }, [state.status, userLocation, focusLat, focusLng]);

  const handleLocatePress = async () => {
    const coordinate = await locateUser();
    if (!coordinate) {
      Alert.alert(
        "Lokasi tidak tersedia",
        "Aktifkan izin lokasi dan GPS untuk melihat posisimu di peta.",
      );
      return;
    }
    setPendingFlyTarget({ lat: coordinate.latitude, lng: coordinate.longitude, zoom: 16 });
  };

  const handleSelectResult = (stop: TransitStop) => {
    clearBlurTimeout();
    setIsSearchFocused(false);
    // BUG (dilaporkan user: "search kedua kali tidak muncul rekomendasi"):
    // di native, tap baris hasil TIDAK mem-blur TextInput-nya — keyboard
    // tetap terbuka dan input tetap fokus secara native, padahal state
    // isSearchFocused sudah di-set false di baris atas. Akibatnya saat user
    // mengetik lagi, TIDAK ada transisi blur->focus, jadi onFocus tidak
    // pernah jalan lagi, isSearchFocused tetap false selamanya, dan
    // dropdown tidak pernah muncul lagi sampai layar dibuka ulang.
    // blur() eksplisit di sini menyamakan state native dengan state React.
    // (onChangeText di bawah juga ikut menyalakan isSearchFocused sebagai
    // pengaman kedua — mengetik jelas berarti user sedang pakai field ini,
    // terlepas dari event fokus mana yang sempat/tidak sempat jalan.)
    searchInputRef.current?.blur();
    setSearchQuery(stop.name);
    // Pastikan moda halte yang dipilih memang aktif — kalau user cari
    // sesuatu dari moda yang chip-nya lagi mati (mis. JakLingko), hasil
    // tap tidak ada gunanya kalau titiknya tetap tersembunyi di peta.
    setActiveModes((current) => {
      if (current.has(stop.mode)) return current;
      const next = new Set(current);
      next.add(stop.mode);
      return next;
    });
    setPendingFlyTarget({ lat: stop.lat, lng: stop.lng, mode: stop.mode });
  };

  const showSearchDropdown = isSearchFocused && trimmedQuery.length >= MIN_SEARCH_LENGTH;

  return (
    <View className="flex-1 bg-[#18181B]">
      <ScreenHeader title="Peta Semua Halte" />

      {state.status === "loading" ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#018959" />
          <Text className="text-surface-2 text-sm">Memuat data halte se-Jakarta...</Text>
        </View>
      ) : state.status === "error" ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="warning-outline" size={40} color="#EF4444" />
          <Text className="text-white text-center font-bold">
            {state.message}
          </Text>
          <Pressable
            onPress={load}
            className="bg-brand-blue px-5 py-2.5 rounded-xl mt-2"
          >
            <Text className="text-white font-bold">Coba Lagi</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <AllStopsMapView
            ref={mapRef}
            stops={filteredStops}
            bottomInset={chipsHeight}
            userLocation={userLocation}
          />

          <View className="absolute top-28 left-5 right-5 z-10">
            <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center gap-2 bg-surface/95 px-4 py-3 rounded-full">
              <Ionicons name="search" size={16} color="#737373" />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  // Pengaman kedua untuk bug "search kedua kali" — lihat
                  // catatan di handleSelectResult.
                  clearBlurTimeout();
                  setIsSearchFocused(true);
                }}
                onFocus={() => {
                  clearBlurTimeout();
                  setIsSearchFocused(true);
                }}
                onBlur={() => {
                  blurTimeoutRef.current = setTimeout(() => setIsSearchFocused(false), 150);
                }}
                placeholder="Cari nama halte..."
                placeholderTextColor="#737373"
                className="flex-1 font-jakarta text-ink font-bold text-sm"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    setSearchQuery("");
                    // Fokus balik ke field supaya user bisa langsung ketik
                    // ulang tanpa tap dua kali — pola sama dengan tombol X
                    // di LocationAutocompleteField (Task App-09).
                    searchInputRef.current?.focus();
                  }}
                  hitSlop={8}
                  accessibilityLabel="Hapus pencarian"
                >
                  <Ionicons name="close-circle" size={18} color="#737373" />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={handleLocatePress}
              disabled={isLocating}
              accessibilityRole="button"
              accessibilityLabel="Tampilkan lokasi saya"
              className="bg-surface p-3 rounded-full shadow-md"
            >
              {isLocating ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Ionicons
                  name={userLocation ? "locate" : "locate-outline"}
                  size={20}
                  color="#3B82F6"
                />
              )}
            </Pressable>
            </View>

            {showSearchDropdown && (
              <View className="mt-2 bg-surface border border-line rounded-xl overflow-hidden max-h-80">
                {searchResults.length === 0 ? (
                  <View className="px-4 py-3">
                    <Text className="text-muted text-sm">
                      Tidak ada halte bernama &quot;{trimmedQuery}&quot;
                    </Text>
                  </View>
                ) : (
                  // Bug dilaporkan user: hasil (bisa sampai 20 baris) tidak
                  // bisa di-scroll — View biasa + overflow-hidden cuma
                  // MEMOTONG konten yang lebih tinggi dari max-h-80, tidak
                  // pernah bikin bisa digulir. ScrollView-nya butuh
                  // keyboardShouldPersistTaps="handled": dropdown ini selalu
                  // tampil SAAT keyboard terbuka (search sedang fokus), jadi
                  // tanpa itu tap ke salah satu baris akan "dimakan" gestur
                  // tutup-keyboard duluan sebelum onPress sempat jalan — bug
                  // yang sama persis dengan yang diperbaiki di Beranda
                  // (Task App-09).
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={true}
                  >
                    {searchResults.map((stop, index) => (
                      <SearchResultRow
                        key={`${stop.mode}-${stop.name}-${index}`}
                        stop={stop}
                        onPress={() => handleSelectResult(stop)}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Penanda halte yang dituju saat layar ini dibuka dari daftar
                "Halte Terdekat" — supaya jelas titik mana yang dikejar
                kamera di antara ribuan titik lain. */}
            {focusName && showFocusBanner && !showSearchDropdown && (
              <View className="mt-2 flex-row items-center gap-2 bg-surface px-4 py-2.5 rounded-full border border-line self-start max-w-full">
                <Ionicons name="location" size={14} color="#018959" />
                <Text className="text-ink text-xs font-bold flex-shrink" numberOfLines={1}>
                  {focusName}
                </Text>
                <Pressable
                  onPress={() => setShowFocusBanner(false)}
                  hitSlop={8}
                  accessibilityLabel="Tutup penanda halte"
                >
                  <Ionicons name="close" size={14} color="#737373" />
                </Pressable>
              </View>
            )}
          </View>

          <View
            className="absolute bottom-8 left-5 right-5 z-10 flex-row flex-wrap gap-2 justify-center"
            // Tingginya berubah tergantung lebar layar (4 chip bisa jadi 1
            // atau 2 baris) — diukur, bukan ditebak, lalu dipakai peta
            // untuk menaruh kartu info halte tepat di atas baris ini.
            onLayout={(e) => setChipsHeight(e.nativeEvent.layout.height)}
          >
            {ALL_MODES.map((mode) => (
              <ModeToggleChip
                key={mode}
                mode={mode}
                count={countByMode[mode]}
                active={activeModes.has(mode)}
                onToggle={() => toggleMode(mode)}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

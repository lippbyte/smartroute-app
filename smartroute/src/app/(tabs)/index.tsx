import ScreenBackground from "@/components/ScreenBackground";
import DepartureTimeField, {
  DEFAULT_DEPARTURE_TIME,
  DepartureTimeValue,
} from "@/components/DepartureTimeField";
import QuickLocationCard from "@/components/QuickLocationCard";
import QuickLocationPickerModal from "@/components/QuickLocationPickerModal";
import RealTimeInfoCard from "@/components/RealTimeInfoCard";
import { LocationAutocompleteFieldHandle } from "@/components/LocationAutocompleteField";
import RouteCard from "@/components/RouteCard";
import Text from "@/components/Text";
import TopNav from "@/components/TopNav";
import { getCurrentLocationLabel } from "@/utils/currentLocation";
import { buildDepartureTimeIso, validateHourMinute } from "@/utils/departureTime";
import { Coordinate, PlaceSuggestion } from "@/utils/geocode";
import {
  getAllQuickLocations,
  QuickLocationSlot,
  removeQuickLocation,
  SavedQuickLocation,
  saveQuickLocation,
} from "@/utils/quickLocations";
import { Ionicons } from "@expo/vector-icons";
import { parseCoordParam } from "@/utils/stopActions";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// Perluasan Task App-21 (diminta user langsung): metadata per slot "Tujuan
// Cepat" — satu sumber untuk title/icon/label dialog, dipakai baik untuk
// render kartu maupun untuk teks Alert/modal, supaya tidak ada 3 salinan
// string yang bisa diam-diam berbeda.
const QUICK_LOCATION_SLOTS: {
  slot: QuickLocationSlot;
  title: string;
  iconName: "briefcase" | "school" | "home";
}[] = [
  { slot: "kantor", title: "Kantor", iconName: "briefcase" },
  { slot: "kampus", title: "Kampus", iconName: "school" },
  { slot: "rumah", title: "Rumah", iconName: "home" },
];

// Balon ajakan di pojok kanan atas kartu TOTO; naik-turun pelan supaya
// kelihatan tanpa mengganggu. pointerEvents none: tap tetap ke kartu.
function AskTotoBubble() {
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = withRepeat(withTiming(-4, { duration: 900 }), -1, true);
  }, [offset]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: -18, right: 14, alignItems: "flex-end" }, style]}
    >
      <View className="bg-[#018959] px-3 py-1.5 rounded-full flex-row items-center gap-1 shadow-md">
        <Ionicons name="chatbubble-ellipses" size={12} color="#FFFFFF" />
        <Text className="text-white font-bold text-xs">Ayo tanya TOTO!</Text>
      </View>
      <View
        style={{
          marginRight: 18,
          width: 0,
          height: 0,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 7,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: "#018959",
        }}
      />
    </Animated.View>
  );
}

interface PickedPlace {
  label: string;
  coordinate?: Coordinate;
}

export default function Index() {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  // Koordinat PASTI untuk label yang sedang terisi (saran yang di-tap, GPS,
  // Tujuan Cepat). Dipakai hanya kalau teks field masih persis label itu —
  // begitu user mengetik ulang, kembali ke pencarian teks. Tanpa ini layar
  // hasil menebak ulang koordinat dari teks, dan bisa jatuh ke tempat lain
  // yang senama (atau ke hasil teratas Nominatim untuk label GPS).
  const [originPick, setOriginPick] = useState<PickedPlace | null>(null);
  const [destinationPick, setDestinationPick] = useState<PickedPlace | null>(null);
  // Perluasan Task App-21: dipakai handleQuickLocationPress untuk blur()
  // field Tujuan tepat setelah mengisinya dari luar — lihat catatan
  // lengkap di LocationAutocompleteFieldHandle soal bug yang ini perbaiki
  // (keyboard + dropdown "Tidak ada hasil" muncul tak diminta).
  const destinationFieldRef = useRef<LocationAutocompleteFieldHandle>(null);
  // Task App-08: "enabled: false" (toggle di posisi "Sekarang") berarti
  // departure_time TIDAK dikirim ke backend sama sekali di handleSearch
  // (bukan dikirim dengan nilai "waktu sekarang" yang dihitung di sini) —
  // itu penting supaya perilaku default persis sama dengan sebelum task
  // ini: backend sendiri yang menentukan "sekarang" saat menerima request
  // tanpa departure_time, bukan snapshot waktu saat form diisi.
  const [departureTime, setDepartureTime] = useState<DepartureTimeValue>(
    DEFAULT_DEPARTURE_TIME,
  );

  // Task App-05: auto-isi "Dari" via GPS saat layar dibuka. Izin ditolak ->
  // getCurrentLocationLabel mengembalikan null, field tetap kosong seperti
  // semula, tidak ada dialog error. Guard "origin masih kosong" di titik
  // setOrigin (bukan di awal effect) supaya kalau user sempat mengetik
  // manual sebelum GPS+reverse-geocode selesai, hasil GPS yang telat itu
  // tidak menimpa ketikan mereka.
  useEffect(() => {
    let cancelled = false;

    getCurrentLocationLabel().then((result) => {
      if (cancelled || !result) return;
      setOrigin((current) => {
        if (current.trim() !== "") return current;
        setOriginPick({ label: result.label, coordinate: result.coordinate });
        return result.label;
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // "Berangkat dari sini" (Halte Terdekat / peta halte / Asisten AI): isi
  // "Dari" dengan halte itu beserta koordinat pastinya — titik berangkat
  // tepat di halte memberi hasil pencarian rute paling lengkap. Menimpa
  // isian GPS di atas karena ini pilihan eksplisit user.
  const { fromStop, fromStopCoord } = useLocalSearchParams<{
    fromStop?: string;
    fromStopCoord?: string;
  }>();
  useEffect(() => {
    const coordinate = parseCoordParam(fromStopCoord);
    if (!fromStop || !coordinate) return;
    setOrigin(fromStop);
    setOriginPick({ label: fromStop, coordinate });
  }, [fromStop, fromStopCoord]);

  // Perluasan Task App-21 (diminta user langsung): "Tujuan Cepat" yang
  // sebelumnya murni dekoratif (onPress tidak pernah diisi) — sekarang bisa
  // diisi lokasi tersimpan lewat pencarian, lalu tap untuk isi cepat field
  // "Tujuan". Dimuat sekali saat Beranda dibuka; disegarkan lagi tiap
  // berhasil simpan/hapus (lihat handler di bawah) TANPA reload manual.
  const [quickLocations, setQuickLocations] = useState<
    Record<QuickLocationSlot, SavedQuickLocation | null>
  >({ kantor: null, kampus: null, rumah: null });
  const [activePickerSlot, setActivePickerSlot] =
    useState<QuickLocationSlot | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllQuickLocations().then((result) => {
      if (!cancelled) setQuickLocations(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleQuickLocationPress = (slot: QuickLocationSlot) => {
    const saved = quickLocations[slot];
    if (saved) {
      // Sudah diisi -> isi cepat field Tujuan, user tetap tap "Cari Rute
      // Terbaik" sendiri (konsisten dengan alur pencarian yang sudah ada,
      // tidak ada navigasi otomatis yang mengejutkan).
      setDestination(saved.label);
      setDestinationPick({ label: saved.label, coordinate: saved.coordinate });
      // Bug dilaporkan dari device fisik: kalau field Tujuan kebetulan
      // masih fokus dari interaksi sebelumnya, mengisinya dari sini
      // memicu keyboard muncul + pencarian otomatis atas nama lokasi
      // yang baru saja disimpan (hampir pasti nol hasil). blur() paksa
      // field-nya tidak fokus — lihat LocationAutocompleteFieldHandle.
      destinationFieldRef.current?.blur();
      return;
    }
    // Belum diisi -> buka dialog cari lokasi untuk slot ini.
    setActivePickerSlot(slot);
  };

  const handleQuickLocationLongPress = (slot: QuickLocationSlot) => {
    const saved = quickLocations[slot];
    // Belum ada apa-apa untuk diubah/dihapus -> long-press di slot kosong
    // tidak melakukan apa-apa (tap biasa sudah membuka dialog isi).
    if (!saved) return;

    const slotMeta = QUICK_LOCATION_SLOTS.find((s) => s.slot === slot)!;
    Alert.alert(slotMeta.title, saved.label, [
      { text: "Ubah Lokasi", onPress: () => setActivePickerSlot(slot) },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          await removeQuickLocation(slot);
          setQuickLocations((current) => ({ ...current, [slot]: null }));
        },
      },
      { text: "Batal", style: "cancel" },
    ]);
  };

  const handlePickerSelect = async (suggestion: PlaceSuggestion) => {
    const slot = activePickerSlot;
    if (!slot) return;
    const location: SavedQuickLocation = {
      label: suggestion.displayName,
      coordinate: suggestion.coordinate,
    };
    await saveQuickLocation(slot, location);
    setQuickLocations((current) => ({ ...current, [slot]: location }));
    setActivePickerSlot(null);
  };

  // Tombol tukar di tengah kartu: asal <-> tujuan, berikut koordinat pasti
  // masing-masing (kalau ada) supaya hasil pencarian tetap presisi.
  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
    setOriginPick(destinationPick);
    setDestinationPick(originPick);
  };

  // Task Integration-01: sebelumnya tombol ini tidak melakukan apa-apa
  // (mockApiResponse langsung dipakai statis di layar hasil rute). Sekarang
  // asal/tujuan nyata dikirim sebagai search params ke /route, yang
  // memanggil fetchRealRoutes ke backend asli.
  const handleSearch = () => {
    if (!origin.trim() || !destination.trim()) {
      Alert.alert(
        "Lengkapi dulu",
        "Isi asal dan tujuan sebelum mencari rute.",
      );
      return;
    }

    // Task App-08: cuma bangun & kirim departure_time kalau user benar-benar
    // menyalakan "Atur waktu" — toggle di posisi "Sekarang" berarti param
    // ini tidak disertakan sama sekali (lihat catatan di deklarasi state).
    let departureTimeIso: string | undefined;
    if (departureTime.enabled) {
      const validationError = validateHourMinute(
        departureTime.hour,
        departureTime.minute,
      );
      if (validationError) {
        Alert.alert("Jam tidak valid", validationError);
        return;
      }
      departureTimeIso = buildDepartureTimeIso(
        Number(departureTime.hour),
        Number(departureTime.minute),
      );
    }

    const coordParam = (pick: PickedPlace | null, text: string) =>
      pick && pick.label.trim() === text.trim() && pick.coordinate
        ? `${pick.coordinate.latitude},${pick.coordinate.longitude}`
        : undefined;
    const originCoord = coordParam(originPick, origin);
    const destinationCoord = coordParam(destinationPick, destination);

    router.push({
      pathname: "/route",
      params: {
        origin: origin.trim(),
        destination: destination.trim(),
        ...(originCoord ? { originCoord } : {}),
        ...(destinationCoord ? { destinationCoord } : {}),
        ...(departureTimeIso ? { departureTime: departureTimeIso } : {}),
      },
    });
  };

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 items-center gap-6 pt-12 pb-28"
        showsVerticalScrollIndicator={false}
        // Task App-09: tanpa ini, default RN ("never") membuat ScrollView
        // MENYERAP tap di luar TextInput yang sedang fokus untuk menutup
        // keyboard duluan — dropdown saran LocationAutocompleteField jadi
        // terlihat tapi tidak bisa di-tap sama sekali. Ini murni perilaku
        // native (keyboard overlay); tidak ada di web (RN Web tidak punya
        // apa yang perlu "diserap"), makanya lolos verifikasi App-06 yang
        // dites di web. "handled" = kalau tap kena komponen yang punya
        // handler (Pressable-nya dropdown), biarkan itu jalan & keyboard
        // tetap terbuka; kalau tidak kena apa-apa, tetap tutup seperti biasa.
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full">
          <TopNav />
        </View>

        {/* Greetings — di atas latar biru malam, jadi putih. */}
        <View className="gap-2.5">
          <Text className="text-4xl font-bold text-white text-center">
            SmartRoute AI
          </Text>
          <Text className="text-center" style={{ color: "#F4F4F0" }}>
            Hai, Selamat Pagi!{"\n"}Mau ke mana hari ini?
          </Text>
        </View>

        {/* Form Card Input Rute */}
        <RouteCard
          origin={origin}
          destination={destination}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          destinationFieldRef={destinationFieldRef}
          onOriginSelect={(s) =>
            setOriginPick({ label: s.displayName, coordinate: s.coordinate })
          }
          onDestinationSelect={(s) =>
            setDestinationPick({ label: s.displayName, coordinate: s.coordinate })
          }
          onSwap={handleSwap}
        />

        {/* Task App-08: kunci waktu keberangkatan (rehearsal/demo) */}
        <DepartureTimeField value={departureTime} onChange={setDepartureTime} />

        {/* Tombol Action Utama */}
        <Pressable
          onPress={handleSearch}
          className="w-full bg-[#018959] py-3.5 rounded-2xl flex-row items-center justify-center gap-2 active:opacity-80"
        >
          <Ionicons name="search" size={20} color="#FFFFFF" />
          <Text className="text-white font-bold text-md">
            Cari Rute Terbaik
          </Text>
        </Pressable>

        {/* Task App-01: entry point ke layar peta kepadatan (web-only) */}
        <Pressable
          onPress={() => router.push("/crowd-map")}
          className="w-full bg-surface rounded-2xl p-4 flex-row items-center gap-3 active:opacity-80 border border-line"
        >
          <View className="bg-brand-blue/10 p-2.5 rounded-xl">
            <Ionicons name="map" size={24} color="#0F3FC1" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-ink font-bold text-md">
              Peta Kepadatan
            </Text>
            <Text className="text-muted text-sm">
              Lihat halte yang lagi padat, berdasar laporan pengguna lain.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#737373" />
        </Pressable>

        {/* Task App-15: entry point ke layar "Halte Terdekat" — fitur info
            berdiri sendiri (4 moda), sengaja terpisah dari alur cari-rute di
            atas (batasan eksplisit task), mirip pola kartu Peta Kepadatan. */}
        <Pressable
          onPress={() => router.push("/nearby-stops")}
          className="w-full bg-surface rounded-2xl p-4 flex-row items-center gap-3 active:opacity-80 border border-line"
        >
          <View className="bg-brand-blue/10 p-2.5 rounded-xl">
            <Ionicons name="navigate" size={24} color="#0F3FC1" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-ink font-bold text-md">
              Halte Terdekat
            </Text>
            <Text className="text-muted text-sm">
              Cari halte TransJakarta, MRT, LRT, & JakLingko di sekitarmu.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#737373" />
        </Pressable>

        {/* Task App-22: entry point ke TOTO (Asisten AI). */}
        <Pressable
          onPress={() => router.push("/assistant")}
          className="w-full bg-surface rounded-2xl p-4 flex-row items-center gap-3 active:opacity-80 border border-line relative"
        >
          <View className="bg-primary-emerald/15 p-2.5 rounded-xl">
            <Ionicons name="sparkles" size={24} color="#018959" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-ink font-bold text-md">TOTO · Asisten AI</Text>
            <Text className="text-muted text-sm">
              Tanya halte terdekat, rute, & tarif — dijawab dari data transit asli.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#737373" />
          <AskTotoBubble />
        </Pressable>

        {/* Tujuan Cepat */}
        <View className="gap-4 w-full">
          <Text className="text-md w-full text-left text-white font-bold">
            Tujuan Cepat
          </Text>
          <View className="flex-row gap-4">
            {QUICK_LOCATION_SLOTS.map(({ slot, title, iconName }) => (
              <QuickLocationCard
                key={slot}
                title={title}
                iconName={iconName}
                savedLabel={quickLocations[slot]?.label}
                onPress={() => handleQuickLocationPress(slot)}
                onLongPress={() => handleQuickLocationLongPress(slot)}
              />
            ))}
          </View>
        </View>

        {/* Info Real Time */}
        <View className="gap-4 w-full">
          <Text className="text-md w-full text-left text-white font-bold">
            Informasi
          </Text>
          <View className="gap-4">
            {/* Task App-21: sebelumnya dipanggil 2x berturut-turut di sini
                (bukan loop dari array salah — cuma JSX yang ditulis dobel),
                menghasilkan kartu "Lalu Lintas" identik muncul dua kali. */}
            <RealTimeInfoCard />
          </View>
        </View>
      </ScrollView>

      <QuickLocationPickerModal
        visible={activePickerSlot !== null}
        title={
          activePickerSlot
            ? `Atur Lokasi ${QUICK_LOCATION_SLOTS.find((s) => s.slot === activePickerSlot)!.title}`
            : ""
        }
        onClose={() => setActivePickerSlot(null)}
        onSelect={handlePickerSelect}
      />
    </ScreenBackground>
  );
}

import ScreenBackground from "@/components/ScreenBackground";
import { LEG_MODES, LegModeKey } from "@/components/transit/legModes";
import Text from "@/components/Text";
import TopNav from "@/components/TopNav";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

type HistoryItem = {
  id: string;
  asal: string;
  tujuan: string;
  waktu: string;
  harga: string;
  rating: string;
  durasi: string;
  transportType: string;
};

type HistorySection = {
  title: string;
  data: HistoryItem[];
};

const SECTIONS_DATA: HistorySection[] = [
  {
    title: "Juni 2026",
    data: [
      {
        id: "1",
        asal: "JIS",
        tujuan: "Bundaran HI",
        waktu: "Kam, 13 Jun, 08:40",
        harga: "Rp. 14.000",
        rating: "8.7/10",
        durasi: "60 Menit",
        transportType: "Multi-moda",
      },
      {
        id: "2",
        asal: "Dukuh Atas",
        tujuan: "Lebak Bulus",
        waktu: "Rab, 12 Jun, 17:15",
        harga: "Rp. 10.000",
        rating: "9.0/10",
        durasi: "30 Menit",
        transportType: "MRT",
      },
      {
        id: "3",
        asal: "Blok M",
        tujuan: "Kota",
        waktu: "Sen, 08 Jun, 07:30",
        harga: "Rp. 3.500",
        rating: "8.5/10",
        durasi: "45 Menit",
        transportType: "Transjakarta",
      },
    ],
  },
  {
    title: "Mei 2026",
    data: [
      {
        id: "4",
        asal: "Harmoni",
        tujuan: "Ragunan",
        waktu: "Sab, 30 Mei, 14:00",
        harga: "Rp. 3.500",
        rating: "8.0/10",
        durasi: "50 Menit",
        transportType: "Transjakarta",
      },
      {
        id: "5",
        asal: "Fatmawati",
        tujuan: "Istora Mandiri",
        waktu: "Kam, 21 Mei, 09:10",
        harga: "Rp. 8.000",
        rating: "9.2/10",
        durasi: "20 Menit",
        transportType: "MRT",
      },
      {
        id: "6",
        asal: "Manggarai",
        tujuan: "Bandara Soekarno-Hatta",
        waktu: "Min, 10 Mei, 11:20",
        harga: "Rp. 50.000",
        rating: "9.5/10",
        durasi: "40 Menit",
        transportType: "Multi-moda",
      },
    ],
  },
];

// Ikon & warna moda per jenis perjalanan riwayat — dari legModes.ts supaya
// sama dengan layar hasil & detail rute.
const TRANSPORT_LEGS: Record<string, LegModeKey[]> = {
  MRT: ["walk", "mrt"],
  Transjakarta: ["walk", "brt"],
  "Multi-moda": ["walk", "brt", "krl"],
};

const TRANSPORT_TYPES = ["Semua", "MRT", "Transjakarta", "Multi-moda"];

function ratingColor(rating: string): string {
  const value = parseFloat(rating);
  if (value >= 9) return "#34D399";
  if (value >= 8) return "#FACC15";
  return "#F59E0B";
}

function SummaryCard({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 bg-surface rounded-2xl py-3.5 px-2 items-center gap-1 border border-line">
      <Text className="text-ink font-bold text-lg" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="text-muted text-xs" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function HistoryCard({ item }: { item: HistoryItem }) {
  const legs = TRANSPORT_LEGS[item.transportType] ?? ["walk"];
  return (
    <View className="bg-surface rounded-2xl p-4 gap-3 border border-line">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          {/* Satu Text yang boleh 2 baris: di layar sempit nama tempat
              turun ke baris kedua, bukan terpotong "Dukuh …". */}
          <Text className="text-ink font-bold text-base" numberOfLines={2}>
            {item.asal}
            <Text className="text-muted font-bold text-base"> → </Text>
            {item.tujuan}
          </Text>
          <Text className="text-muted text-xs">{item.waktu}</Text>
        </View>
        <View className="items-end gap-1">
          <Text className="text-ink font-bold text-base">{item.harga}</Text>
          <Text className="text-xs font-semibold" style={{ color: ratingColor(item.rating) }}>
            {item.rating}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between pt-3 border-t border-line">
        <View className="flex-row items-center gap-1">
          {legs.map((key, i) => {
            const mode = LEG_MODES[key];
            return (
              <View key={key} className="flex-row items-center gap-1">
                <View
                  className="w-7 h-7 rounded-lg items-center justify-center"
                  style={{ backgroundColor: `${mode.color}26` }}
                >
                  <Ionicons name={mode.icon} size={15} color={mode.color} />
                </View>
                {i < legs.length - 1 && (
                  <Ionicons name="chevron-forward" size={12} color="#A3A3A3" />
                )}
              </View>
            );
          })}
        </View>
        <View className="flex-row items-center gap-1 bg-surface-2 px-3 py-1.5 rounded-full">
          <Ionicons name="time-outline" size={13} color="#404040" />
          <Text className="text-ink text-xs font-semibold">{item.durasi}</Text>
        </View>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState("Semua");

  const filteredSections = SECTIONS_DATA.map((section) => ({
    ...section,
    data: section.data.filter(
      (item) => selectedType === "Semua" || item.transportType === selectedType,
    ),
  })).filter((section) => section.data.length > 0);

  return (
    <ScreenBackground>
      {/* ScrollView biasa (data sedikit & statis), bukan SectionList: di web
          contentContainerClassName SectionList tidak diterapkan NativeWind,
          jadi padding kiri-kanan hilang dan kartu melebar keluar layar. */}
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
          <Text className="text-2xl font-bold text-white">Riwayat Perjalanan</Text>
        </View>

        <View className="flex-row gap-2">
          <SummaryCard value="24" label="Perjalanan" />
          <SummaryCard value="Rp336rb" label="Total Hemat" />
          <SummaryCard value="28,8 kg" label="CO₂ Hemat" />
        </View>

        {/* Chip filter selebar layar (tidak terpotong). Warna teks lewat
            style — di web class Text yang berganti ditumpuk. */}
        <View className="flex-row flex-wrap gap-2">
          {TRANSPORT_TYPES.map((type) => {
            const active = selectedType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setSelectedType(type)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`${active ? "bg-brand-blue" : "bg-surface-2"} px-4 py-2 rounded-full border border-line`}
              >
                <Text className="font-semibold text-xs" style={{ color: active ? "#FFFFFF" : "#404040" }}>
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filteredSections.map((section) => (
          <View key={section.title} className="gap-3">
            <Text className="text-surface-2 text-sm font-bold uppercase tracking-wider">
              {section.title}
            </Text>
            {section.data.map((item) => (
              <HistoryCard key={item.id} item={item} />
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenBackground>
  );
}

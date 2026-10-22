import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import Text from "./Text";

interface HistoryItemProps {
  origin: string;
  destination: string;
  date: string;
  showBorder?: boolean;
}

function HistoryItem({
  origin,
  destination,
  date,
  showBorder = true,
}: HistoryItemProps) {
  return (
    <View
      className={`flex-row justify-between items-center py-3.5 ${
        showBorder ? "border-b border-line" : ""
      }`}
    >
      {/* Asal — Tujuan di kiri, tanggal ringkas di kanan (sesuai desain). */}
      <View className="flex-1 mr-3 flex-row items-center gap-2">
        <Text className="text-ink-2 text-sm font-semibold flex-shrink" numberOfLines={1}>
          {origin}
        </Text>
        <View style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: "#34D399" }} />
        <Text className="text-ink-2 text-sm font-semibold flex-shrink" numberOfLines={1}>
          {destination}
        </Text>
      </View>
      <Text className="text-muted text-xs font-medium">{date}</Text>
    </View>
  );
}

export default function HistoryCard() {
  const router = useRouter();
  const historyList = [
    {
      id: "1",
      origin: "Stasiun Bandung",
      destination: "Alun-Alun Bandung",
      date: "24/08/26",
      fare: "Rp 5.000",
    },
    {
      id: "2",
      origin: "Lebak Bulus",
      destination: "Bundaran HI",
      date: "20/08/26",
      fare: "Rp 14.000",
    },
    {
      id: "3",
      origin: "Blok M",
      destination: "Monas",
      date: "18/08/26",
      fare: "Rp 3.500",
    },
  ];

  return (
    <View className="bg-surface w-full px-5 py-4 rounded-2xl border border-line">
      <View className="w-full flex-row justify-between items-center">
        <Text className="text-ink font-bold text-lg mb-1">
          Riwayat Perjalanan
        </Text>
        <Pressable
          className="active:opacity-60"
          onPress={() => router.push("/history")}
        >
          <Text className="text-sm mb-1" style={{ color: "#60A5FA" }}>Lihat Semua</Text>
        </Pressable>
      </View>

      <View className="w-full">
        {historyList.map((item, index) => (
          <HistoryItem
            key={item.id}
            origin={item.origin}
            destination={item.destination}
            date={item.date}
            showBorder={index !== historyList.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

// src/app/crowd-map.tsx
//
// Task App-01: overview map showing crowd-density reports across every stop
// that has an active one — a "traffic layer" for crowding, using real
// crowdsourced data from Task Backend-07's GET /crowd-reports list endpoint.
// See backend/Task_App_01_Crowd_Overview_Map.md.
//
// Task App-03: layar ini sekarang shared antar platform. Seluruh bagian
// rendering peta pindah ke <CrowdMapView>, yang punya dua implementasi —
// CrowdMapView.web.tsx (Leaflet di dalam iframe, warisan App-01/App-02) dan
// CrowdMapView.native.tsx (MapLibre React Native). Metro memilih otomatis
// sesuai platform, jadi tidak ada lagi pesan fallback "baru tersedia di versi
// web": native punya implementasi asli sekarang.
//
// Task App-07: tambah cara submit laporan lewat UI (CrowdReportModal) —
// dipicu dari tombol lapor terpisah (cari halte dulu) ATAU dari tap marker
// yang sudah tampil di peta (onReportStop). Setelah submit sukses, load()
// dipanggil ulang supaya marker baru langsung terlihat tanpa reload manual.
import CrowdMapView from "@/components/crowd/CrowdMapView";
import CrowdReportModal, {
  CrowdReportTarget,
} from "@/components/crowd/CrowdReportModal";
import { LEVEL_COLOR } from "@/components/crowd/crowdLevel";
import Text from "@/components/Text";
import {
  CrowdOverviewFetchError,
  CrowdOverviewStop,
  fetchCrowdOverview,
} from "@/services/crowdService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

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

function LegendRow() {
  const items: Array<{ level: CrowdOverviewStop["level"]; label: string }> = [
    { level: "low", label: "Lengang" },
    { level: "moderate", label: "Cukup Padat" },
    { level: "high", label: "Padat" },
  ];
  return (
    <View className="absolute bottom-8 left-5 right-5 flex-row justify-center gap-3 z-10">
      <View className="flex-row items-center gap-3 bg-surface/95 px-4 py-2.5 rounded-full">
        {items.map(({ level, label }) => (
          <View key={level} className="flex-row items-center gap-1.5">
            <View
              className="w-2.5 h-2.5 rounded-full border border-line"
              style={{ backgroundColor: LEVEL_COLOR[level] }}
            />
            <Text className="text-ink-2 text-xs">{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Task App-07: FAB terpisah dari marker yang sudah tampil di peta — inilah
// satu-satunya jalan masuk saat peta BENAR-BENAR kosong (0 laporan aktif),
// karena di kondisi itu tidak ada marker sama sekali untuk di-tap. Diletakkan
// di kanan-bawah, DI ATAS LegendRow (dulu sejajar dan menutupi label
// "Padat" di layar sempit).
function ReportFab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="absolute bottom-24 right-5 z-10 flex-row items-center gap-2 bg-[#018959] px-4 py-3 rounded-full shadow-lg active:opacity-80"
    >
      <Ionicons name="megaphone" size={18} color="#FFFFFF" />
      <Text className="text-white font-bold text-sm">Lapor</Text>
    </Pressable>
  );
}

export default function CrowdMapScreen() {
  const [stops, setStops] = useState<CrowdOverviewStop[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<CrowdReportTarget | null>(
    null,
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchCrowdOverview();
      setStops(result);
    } catch (err) {
      setErrorMessage(
        err instanceof CrowdOverviewFetchError || err instanceof Error
          ? err.message
          : "Gagal memuat data kepadatan.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openReportModal = (target: CrowdReportTarget | null) => {
    setReportTarget(target);
    setIsReportModalVisible(true);
  };

  return (
    <View className="flex-1 bg-[#18181B]">
      <ScreenHeader title="Peta Kepadatan" />

      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#018959" />
          <Text className="text-surface-2 text-sm">Memuat data kepadatan...</Text>
        </View>
      ) : errorMessage ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="warning-outline" size={40} color="#EF4444" />
          <Text className="text-white text-center font-bold">
            {errorMessage}
          </Text>
          <Pressable
            onPress={load}
            className="bg-brand-blue px-5 py-2.5 rounded-xl mt-2"
          >
            <Text className="text-white font-bold">Coba Lagi</Text>
          </Pressable>
        </View>
      ) : !stops || stops.length === 0 ? (
        <>
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Ionicons name="cloud-offline-outline" size={40} color="#737373" />
            <Text className="text-white text-center font-bold">
              Belum ada laporan kepadatan saat ini
            </Text>
            <Text className="text-line text-center text-sm">
              Marker akan muncul di sini begitu ada laporan kepadatan aktif dari
              pengguna lain.
            </Text>
          </View>
          <ReportFab onPress={() => openReportModal(null)} />
        </>
      ) : (
        <>
          <CrowdMapView
            stops={stops}
            onReportStop={(stop) =>
              openReportModal({ gtfsId: stop.stop_id, name: stop.name })
            }
          />
          <LegendRow />
          <ReportFab onPress={() => openReportModal(null)} />
        </>
      )}

      <CrowdReportModal
        visible={isReportModalVisible}
        initialStop={reportTarget}
        onClose={() => setIsReportModalVisible(false)}
        onSubmitted={load}
      />
    </View>
  );
}

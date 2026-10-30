// src/app/co2-info.tsx
//
// Hari 2: layar "Tentang angka ini" — faktor emisi, sumber, tahun, asumsi
// okupansi, dan catatan estimasi. Dibaca dari GET /emission-factors, yaitu
// berkas faktor yang SAMA yang dipakai backend menghitung CO₂, jadi
// penjelasan tidak bisa berbeda dari perhitungan. Faktor yang belum dicek
// ke sumber primer ditandai "Belum terverifikasi".
import { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import ScreenBackground from "@/components/ScreenBackground";
import Text from "@/components/Text";
import { ApiError, apiRequest } from "@/services/apiClient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from "react-native";

interface Factor {
  key: string;
  label: string;
  g_per_pkm: number;
  source: string;
  url: string | null;
  year: string;
  occupancy: string;
  note: string;
  verified: boolean;
}

interface FactorsResponse {
  version: string;
  unit: string;
  modes: Factor[];
  comparators: Factor[];
  notes: string[];
}

function FactorRow({ f }: { f: Factor }) {
  return (
    <View className="gap-1.5 py-3 border-b border-line">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-ink text-[15px] flex-1" weight="bold">
          {f.label}
        </Text>
        <Text className="text-ink text-[15px]" weight="bold">
          {f.g_per_pkm} g/pkm
        </Text>
      </View>
      {!f.verified && (
        <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#B45309" }}>
          <Text className="text-[11px]" weight="bold" style={{ color: "#78350F" }}>
            Belum terverifikasi
          </Text>
        </View>
      )}
      <Text className="text-ink-2 text-sm" style={{ lineHeight: 20 }}>
        Sumber: {f.source}
      </Text>
      <Text className="text-ink-2 text-xs">
        Tahun/data: {f.year} · Okupansi: {f.occupancy}
      </Text>
      {f.note ? <Text className="text-ink-2 text-xs" style={{ lineHeight: 18 }}>{f.note}</Text> : null}
      {f.url && (
        <Pressable onPress={() => Linking.openURL(f.url!)} accessibilityRole="link" hitSlop={6} className="self-start">
          <Text className="text-xs underline" weight="semibold" style={{ color: "#0F3FC1" }}>
            Buka sumber
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function Co2InfoScreen() {
  const router = useRouter();
  const [data, setData] = useState<FactorsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiRequest<FactorsResponse>("GET", "/emission-factors", { timeoutMessage: "Memuat penjelasan terlalu lama. Coba lagi." }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat penjelasan.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingTop: 56, paddingBottom: 48, paddingHorizontal: 20, gap: 16 }}>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            className="bg-surface p-2.5 rounded-full border border-line"
          >
            <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
          </Pressable>
          <Text className="text-2xl font-bold text-white" accessibilityRole="header">
            Tentang angka ini
          </Text>
        </View>

        {error && (
          <View className="bg-surface rounded-2xl p-4 gap-3 border border-line">
            <FormMessage tone="error" message={error} />
            <PrimaryButton label="Coba lagi" variant="outline" onPress={load} />
          </View>
        )}
        {!data && !error && <ActivityIndicator size="large" color="#FFFFFF" />}

        {data && (
          <>
            <View className="bg-surface rounded-2xl p-4 gap-2 border border-line">
              <Text className="text-ink text-base" weight="bold">
                Semua angka CO₂ adalah estimasi
              </Text>
              {data.notes.map((n) => (
                <Text key={n} className="text-ink-2 text-sm" style={{ lineHeight: 20 }}>
                  • {n}
                </Text>
              ))}
              <Text className="text-ink-2 text-xs">Satuan: {data.unit} · Versi faktor {data.version}</Text>
            </View>
            <View className="bg-surface rounded-2xl px-4 pt-2 pb-1 border border-line">
              <Text className="text-ink text-base pt-2" weight="bold">
                Faktor per moda
              </Text>
              {data.modes.map((f) => (
                <FactorRow key={f.key} f={f} />
              ))}
            </View>
            <View className="bg-surface rounded-2xl px-4 pt-2 pb-1 border border-line">
              <Text className="text-ink text-base pt-2" weight="bold">
                Pembanding
              </Text>
              {data.comparators.map((f) => (
                <FactorRow key={f.key} f={f} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

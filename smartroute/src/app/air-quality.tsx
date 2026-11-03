// src/app/air-quality.tsx
//
// Detail kualitas udara Jakarta, dibuka dari kartu udara. Semua angka berasal
// dari GET /air-quality (IQAir, tingkat kota, cache 15 menit di backend), jadi
// membuka layar ini tidak menambah panggilan ke IQAir. Baris tanpa data tidak
// ditampilkan, bukan diisi perkiraan.
import { formatReportedAt } from "@/components/crowd/crowdLevel";
import { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import ScreenBackground from "@/components/ScreenBackground";
import Text from "@/components/Text";
import { AQI_ADVICE, AQI_COLORS, AQI_SCALE, fetchAirQuality, IQAIR_CITY_URL, type AirQuality } from "@/services/airQualityService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from "react-native";

const dateTimeOrNull = (iso: string | null | undefined) => (iso ? formatReportedAt(iso) : null);

const decimal = (n: number) => String(n).replace(".", ",");

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="bg-surface rounded-2xl p-4 gap-2 border border-line">
      {title && (
        <Text className="text-ink text-base" weight="bold" accessibilityRole="header">
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null;
  return (
    <View className="flex-row items-start justify-between gap-3 py-1">
      <Text className="text-ink-2 text-sm flex-1">{label}</Text>
      <Text className="text-ink text-sm text-right flex-shrink" weight="semibold">
        {value}
      </Text>
    </View>
  );
}

export default function AirQualityScreen() {
  const router = useRouter();
  const [air, setAir] = useState<AirQuality | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setAir(await fetchAirQuality());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const colors = air ? AQI_COLORS[air.category_key] : null;
  const w = air?.weather ?? null;

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
          <Text className="text-2xl font-bold text-white flex-1" accessibilityRole="header">
            Kualitas udara
          </Text>
        </View>

        {loading && !air && <ActivityIndicator size="large" color="#FFFFFF" />}

        {!loading && !air && (
          <Card>
            <FormMessage tone="error" message="Data kualitas udara sedang tidak tersedia." />
            <PrimaryButton label="Coba lagi" variant="outline" onPress={load} />
          </Card>
        )}

        {air && colors && (
          <>
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="rounded-xl items-center justify-center" style={{ backgroundColor: colors.bg, width: 64, height: 64 }}>
                  <Text className="text-2xl" weight="bold" style={{ color: colors.text }}>
                    {air.aqi_us}
                  </Text>
                  <Text className="text-[10px]" weight="semibold" style={{ color: colors.text }}>
                    AQI
                  </Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-ink text-base" weight="bold">
                    Udara {air.city}: {air.category}
                  </Text>
                  {air.stale && (
                    <Text className="text-xs" weight="semibold" style={{ color: "#404040" }}>
                      Data tidak terbaru
                    </Text>
                  )}
                </View>
              </View>
              <Text className="text-ink-2 text-sm" style={{ lineHeight: 20 }}>
                {AQI_ADVICE[air.category_key]}
              </Text>
            </Card>

            <Card title="Detail pengukuran">
              <Row label="AQI (standar AS)" value={String(air.aqi_us)} />
              <Row label="Polutan utama" value={air.pollutant_main} />
              <Row label="Waktu pengukuran" value={dateTimeOrNull(air.observed_at)} />
              <Row label="Diambil dari IQAir" value={dateTimeOrNull(air.fetched_at)} />
            </Card>

            {w && (
              <Card title="Cuaca">
                <Row label="Suhu" value={w.temp_c === null ? null : `${decimal(w.temp_c)}°C`} />
                <Row label="Kelembapan" value={w.humidity_pct === null ? null : `${decimal(w.humidity_pct)}%`} />
                <Row label="Angin" value={w.wind_ms === null ? null : `${decimal(w.wind_ms)} m/dtk`} />
                <Row label="Tekanan udara" value={w.pressure_hpa === null ? null : `${decimal(w.pressure_hpa)} hPa`} />
                <Row label="Waktu cuaca" value={dateTimeOrNull(w.observed_at)} />
              </Card>
            )}

            <Card title="Skala AQI">
              {AQI_SCALE.map((s) => {
                const current = s.key === air.category_key;
                return (
                  <View
                    key={s.key}
                    className="flex-row items-center gap-3 rounded-lg px-2 py-1.5"
                    style={current ? { backgroundColor: AQI_COLORS[s.key].bg } : undefined}
                    aria-selected={current}
                  >
                    <View className="rounded-full" style={{ width: 12, height: 12, backgroundColor: AQI_COLORS[s.key].text }} />
                    <Text className="text-ink text-sm" weight={current ? "bold" : "normal"} style={{ width: 58 }}>
                      {s.range}
                    </Text>
                    <Text className="text-ink text-sm flex-1" weight={current ? "bold" : "normal"}>
                      {s.label}
                    </Text>
                  </View>
                );
              })}
            </Card>

            <Card>
              <Text className="text-ink-2 text-sm" style={{ lineHeight: 20 }}>
                Data tingkat kota dari IQAir, bukan pengukuran per halte. Informasi umum, bukan saran medis.
              </Text>
              <Pressable onPress={() => Linking.openURL(IQAIR_CITY_URL)} accessibilityRole="link" hitSlop={6} className="self-start">
                <Text className="text-sm underline" weight="semibold" style={{ color: "#0F3FC1" }}>
                  Buka di situs IQAir
                </Text>
              </Pressable>
            </Card>
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

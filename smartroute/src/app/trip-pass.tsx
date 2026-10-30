// src/app/trip-pass.tsx
//
// Hari 3 Task 3: "Trip Pass" — ringkasan perjalanan + tarif per segmen +
// cara bayar umum + kartu DEMO dengan saldo SIMULASI.
// - Tarif: fare_breakdown & cost_idr dari backend apa adanya, TIDAK dihitung
//   ulang di sini.
// - Saldo & top-up: SIMULASI, tersimpan di perangkat (utils/tripPassWallet),
//   tanpa panggilan jaringan, tanpa bank/NFC/uang sungguhan. Label simulasi
//   ada di layar ini dan di setiap langkah modal top-up.
// - Tidak menampilkan logo/merek bank atau operator.
import FormField, { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import ScreenBackground from "@/components/ScreenBackground";
import SimulationBanner from "@/components/SimulationBanner";
import Text from "@/components/Text";
import { LegChain } from "@/components/trip/TripBits";
import { getRoute } from "@/services/routeStore";
import type { FareItem } from "@/type";
import { formatRupiah } from "@/utils/currency";
import { formatRange } from "@/utils/tripFormat";
import {
  applyTopUp,
  checkBalance,
  loadBalance,
  MAX_BALANCE,
  parseBalanceInput,
  saveBalance,
  TOPUP_OPTIONS,
} from "@/utils/tripPassWallet";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

// TODO:verifikasi — petunjuk UMUM per moda (keputusan Khalifa: tetap umum,
// tanpa merek). Cocokkan dengan ketentuan resmi operator sebelum dipakai
// sebagai panduan resmi.
const HOW_TO_PAY: Record<FareItem["operator"], string> = {
  TransJakarta:
    "Tap kartu atau metode pembayaran yang diterima di gerbang halte/bus. Pindah antar-bus reguler dalam 3 jam tidak dikenai tarif lagi (menurut aturan tarif yang kami pakai).",
  KRL: "Tap di gerbang stasiun asal dan tap lagi di stasiun tujuan; tarif menurut jarak.",
  MRT: "Tap di gerbang stasiun asal dan tap lagi di stasiun tujuan; tarif menurut jarak.",
  LRT: "Tap di gerbang stasiun asal dan tap lagi di stasiun tujuan; tarif menurut jarak dan jam naik.",
};

type TopUpStep = { step: "pilih" } | { step: "konfirmasi"; amount: number } | { step: "selesai"; amount: number };

export default function TripPassScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const stored = getRoute(id);

  const [balance, setBalance] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [balanceText, setBalanceText] = useState("");
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [topUp, setTopUp] = useState<TopUpStep | null>(null);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  useEffect(() => {
    loadBalance().then(setBalance);
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.navigate("/"));

  if (!stored) {
    return (
      <ScreenBackground>
        <View className="flex-1 justify-center px-6 gap-4">
          <SimulationBanner />
          <View className="bg-surface rounded-2xl p-5 gap-3 border border-line">
            <Text className="text-ink text-lg" weight="bold">
              Data rute sudah tidak tersedia
            </Text>
            <Text className="text-ink-2 text-sm">Cari ulang rute dari Beranda, lalu buka Trip Pass dari detail rute.</Text>
            <PrimaryButton label="Ke Beranda" onPress={() => router.navigate("/")} />
          </View>
        </View>
      </ScreenBackground>
    );
  }

  const { route, originName, destinationName } = stored;
  const total = route.cost_idr;
  const items = route.fare_breakdown ?? [];
  const operators = [...new Set(items.map((i) => i.operator))];
  const status = balance != null ? checkBalance(balance, total) : null;

  const saveInitial = async () => {
    const n = parseBalanceInput(balanceText);
    if (n == null) {
      setBalanceError(`Masukkan angka 0 sampai ${formatRupiah(MAX_BALANCE)}.`);
      return;
    }
    await saveBalance(n);
    setBalance(n);
    setEditing(false);
    setBalanceError(null);
  };

  const confirmTopUp = async (amount: number) => {
    if (balance == null) return;
    const next = applyTopUp(balance, amount);
    if (next == null) {
      setTopUpError(`Saldo simulasi maksimal ${formatRupiah(MAX_BALANCE)}.`);
      return;
    }
    await saveBalance(next);
    setBalance(next);
    setTopUp({ step: "selesai", amount });
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingTop: 56, paddingBottom: 48, paddingHorizontal: 20, gap: 14 }}>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Kembali" className="bg-surface p-2.5 rounded-full border border-line">
            <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
          </Pressable>
          <Text className="text-2xl font-bold text-white" accessibilityRole="header">
            Trip Pass
          </Text>
        </View>

        <SimulationBanner />

        {/* Ringkasan perjalanan */}
        <View className="bg-surface rounded-2xl p-4 gap-3 border border-line">
          <Text className="text-ink text-base" weight="bold">
            {originName} → {destinationName}
          </Text>
          <LegChain modes={route.legs.map((l) => l.mode)} />
          <Text className="text-ink-2 text-sm">
            Estimasi {formatRange(route.travel_time_range) ?? `${route.travel_time_minutes} mnt`} · {route.transfers}x transit
          </Text>
        </View>

        {/* Tarif per segmen (dari backend) */}
        <View className="bg-surface rounded-2xl p-4 gap-2 border border-line">
          <Text className="text-ink text-base" weight="bold">
            Tarif per bagian perjalanan
          </Text>
          {items.length === 0 && <Text className="text-ink-2 text-sm">Rute ini tidak memakai angkutan bertarif.</Text>}
          {items.map((it, i) => (
            <View key={`${it.label}-${i}`} className="flex-row items-start justify-between gap-3 py-2 border-b border-line">
              <View className="flex-1 gap-0.5">
                <Text className="text-ink text-sm" weight="semibold">
                  {it.label}
                </Text>
                {it.note && <Text className="text-ink-2 text-xs">{it.note}</Text>}
              </View>
              <Text className="text-ink text-sm" weight="bold">
                {it.fare_idr == null ? "—" : it.fare_idr === 0 ? "Gratis" : formatRupiah(it.fare_idr)}
              </Text>
            </View>
          ))}
          <View className="flex-row items-center justify-between pt-1">
            <Text className="text-ink text-base" weight="bold">
              Total estimasi
            </Text>
            <Text className="text-ink text-lg" weight="bold" accessibilityLabel={`Total estimasi ${formatRupiah(total)}`}>
              {formatRupiah(total)}
            </Text>
          </View>
          <Text className="text-ink-2 text-xs">Dari mesin rute SmartRoute; tarif di gerbang bisa berbeda.</Text>
        </View>

        {/* Cara bayar — umum, tanpa merek */}
        {operators.length > 0 && (
          <View className="bg-surface rounded-2xl p-4 gap-2 border border-line">
            <Text className="text-ink text-base" weight="bold">
              Cara bayar (petunjuk umum)
            </Text>
            {operators.map((op) => (
              <View key={op} className="gap-0.5">
                <Text className="text-ink text-sm" weight="semibold">
                  {op}
                </Text>
                <Text className="text-ink-2 text-sm" style={{ lineHeight: 20 }}>
                  {HOW_TO_PAY[op]}
                </Text>
              </View>
            ))}
            <Text className="text-ink-2 text-xs">Cek ketentuan resmi masing-masing operator sebelum berangkat.</Text>
          </View>
        )}

        {/* Kartu demo & saldo simulasi */}
        <View className="bg-surface rounded-2xl p-4 gap-3 border border-line">
          <View className="rounded-2xl p-4 gap-1" style={{ backgroundColor: "#0F3F80" }} accessible accessibilityLabel={`Kartu demo. Saldo simulasi ${balance == null ? "memuat" : formatRupiah(balance)}`}>
            <Text className="text-xs" weight="semibold" style={{ color: "#E2E8F0" }}>
              KARTU DEMO · SIMULASI
            </Text>
            <Text className="text-2xl" weight="bold" style={{ color: "#FFFFFF" }}>
              {balance == null ? "…" : formatRupiah(balance)}
            </Text>
            <Text className="text-xs" style={{ color: "#E2E8F0" }}>
              Saldo tersimpan di perangkat ini, bukan kartu asli.
            </Text>
          </View>

          <PrimaryButton label="Cek saldo (simulasi)" onPress={() => setChecked(true)} />
          {checked && status && balance != null && (
            <View
              className="rounded-xl p-3 gap-1"
              style={{ backgroundColor: status.status === "cukup" ? "#D1FAE5" : "#FEF2F2", borderWidth: 1, borderColor: status.status === "cukup" ? "#065F46" : "#B91C1C" }}
              accessibilityLiveRegion="polite"
            >
              <Text className="text-base" weight="bold" style={{ color: status.status === "cukup" ? "#065F46" : "#7F1D1D" }}>
                {status.status === "cukup" ? "Cukup" : `Kurang ${formatRupiah(status.shortfall)}`}
              </Text>
              <Text className="text-sm" style={{ color: status.status === "cukup" ? "#065F46" : "#7F1D1D" }}>
                Saldo {formatRupiah(balance)} · total {formatRupiah(total)} ·{" "}
                {status.status === "cukup" ? `sisa ${formatRupiah(status.remaining)}` : `selisih ${formatRupiah(status.shortfall)}`}
              </Text>
            </View>
          )}

          <PrimaryButton
            label="Top-up (simulasi)"
            variant="outline"
            onPress={() => {
              setTopUpError(null);
              setTopUp({ step: "pilih" });
            }}
          />

          {editing ? (
            <View className="gap-2">
              <FormField
                label="Saldo awal simulasi (Rp)"
                value={balanceText}
                onChangeText={setBalanceText}
                keyboardType="number-pad"
                error={balanceError}
                hint={`0 sampai ${formatRupiah(MAX_BALANCE)}`}
              />
              <PrimaryButton label="Simpan saldo awal" onPress={saveInitial} />
              <PrimaryButton label="Batal" variant="outline" onPress={() => setEditing(false)} />
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setBalanceText(balance != null ? String(balance) : "");
                setEditing(true);
              }}
              accessibilityRole="button"
              className="self-start py-1"
              hitSlop={8}
            >
              <Text className="text-sm underline" weight="semibold" style={{ color: "#0F3FC1" }}>
                Ubah saldo awal simulasi
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Top-up SIMULASI: pilih nominal -> konfirmasi -> selesai. */}
      <Modal visible={!!topUp} transparent animationType="fade" onRequestClose={() => setTopUp(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-surface rounded-t-3xl p-5 gap-4" style={{ paddingBottom: 32 }}>
            <SimulationBanner />
            {topUp?.step === "pilih" && (
              <>
                <Text className="text-ink text-xl" weight="bold" accessibilityRole="header">
                  Top-up saldo simulasi
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {TOPUP_OPTIONS.map((amount) => (
                    <Pressable
                      key={amount}
                      onPress={() => setTopUp({ step: "konfirmasi", amount })}
                      accessibilityRole="button"
                      accessibilityLabel={`Pilih ${formatRupiah(amount)}`}
                      className="rounded-xl items-center justify-center active:opacity-80"
                      style={{ minHeight: 52, minWidth: "47%", flexGrow: 1, borderWidth: 1.5, borderColor: "#0F3FC1", backgroundColor: "#FFFFFF" }}
                    >
                      <Text className="text-base" weight="bold" style={{ color: "#0F3FC1" }}>
                        {formatRupiah(amount)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <PrimaryButton label="Batal" variant="outline" onPress={() => setTopUp(null)} />
              </>
            )}
            {topUp?.step === "konfirmasi" && (
              <>
                <Text className="text-ink text-xl" weight="bold" accessibilityRole="header">
                  Tambah {formatRupiah(topUp.amount)}?
                </Text>
                <Text className="text-ink-2 text-[15px]" style={{ lineHeight: 22 }}>
                  Saldo simulasi bertambah dari {formatRupiah(balance ?? 0)} menjadi {formatRupiah((balance ?? 0) + topUp.amount)}. Tidak ada
                  uang sungguhan yang dipindahkan.
                </Text>
                {topUpError && <FormMessage tone="error" message={topUpError} />}
                <PrimaryButton label="Konfirmasi top-up simulasi" onPress={() => confirmTopUp(topUp.amount)} />
                <PrimaryButton label="Kembali" variant="outline" onPress={() => setTopUp({ step: "pilih" })} />
              </>
            )}
            {topUp?.step === "selesai" && (
              <>
                <Text className="text-ink text-xl" weight="bold" accessibilityRole="header" accessibilityLiveRegion="polite">
                  Saldo simulasi bertambah {formatRupiah(topUp.amount)}
                </Text>
                <Text className="text-ink-2 text-[15px]">Saldo simulasi sekarang {formatRupiah(balance ?? 0)}.</Text>
                <PrimaryButton label="Tutup" onPress={() => setTopUp(null)} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

// src/components/trip/RatingSheet.tsx
//
// Hari 1 Task 6: penilaian perjalanan.
// - Bintang 1–5 wajib (tombol Kirim non-aktif tanpa bintang).
// - 3 pertanyaan cepat Ya / Tidak / Lewati (bawaan Lewati = null).
// - Pesan opsional <= 500 karakter (dengan penghitung).
// - Sekali per perjalanan: 409 dari server -> pesan jelas, draf dihapus.
// - Draf bertahan saat jaringan gagal (utils/ratingDrafts.ts).
// Teks terima kasih singkat & jujur — tanpa "Selamat".
import { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import Text from "@/components/Text";
import { ApiError, NETWORK_ERROR_MESSAGE } from "@/services/apiClient";
import * as tripService from "@/services/tripService";
import type { Trip } from "@/services/tripService";
import { Answer, clearDraft, EMPTY_DRAFT, loadDraft, RatingDraft, saveDraft } from "@/utils/ratingDrafts";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";

const MESSAGE_MAX = 500;
const BLUE = "#0F3FC1";

const QUESTIONS: { key: "eta" | "transferRisk" | "crowd"; label: string }[] = [
  { key: "eta", label: "ETA sesuai?" },
  { key: "transferRisk", label: "Risiko transfer sesuai?" },
  { key: "crowd", label: "Kepadatan sesuai laporan?" },
];

const ANSWERS: { value: Answer; label: string }[] = [
  { value: "ya", label: "Ya" },
  { value: "tidak", label: "Tidak" },
  { value: null, label: "Lewati" },
];

const toBool = (a: Answer) => (a === null ? null : a === "ya");

interface Props {
  visible: boolean;
  token: string;
  trip: Pick<Trip, "id" | "origin_label" | "destination_label">;
  onClose: () => void;
  /** Dipanggil setelah penilaian tersimpan (atau ternyata sudah ada). */
  onRated: (trip: Trip) => void;
}

export default function RatingSheet({ visible, token, trip, onClose, onRated }: Props) {
  const [draft, setDraft] = useState<RatingDraft>(EMPTY_DRAFT);
  const [hadDraft, setHadDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Trip | null>(null);

  // Pulihkan draf setiap kali lembar dibuka.
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setDone(null);
    let cancelled = false;
    loadDraft(trip.id).then((saved) => {
      if (cancelled) return;
      setDraft(saved ?? EMPTY_DRAFT);
      setHadDraft(!!saved);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, trip.id]);

  const update = (patch: Partial<RatingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      void saveDraft(trip.id, next);
      return next;
    });
  };

  const submit = async () => {
    if (!draft.stars) return;
    setSending(true);
    setError(null);
    await saveDraft(trip.id, draft);
    try {
      const saved = await tripService.rateTrip(token, trip.id, {
        stars: draft.stars,
        eta_accurate: toBool(draft.eta),
        transfer_risk_accurate: toBool(draft.transferRisk),
        crowd_accurate: toBool(draft.crowd),
        message: draft.message.trim() ? draft.message.trim() : null,
      });
      await clearDraft(trip.id);
      setDone(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await clearDraft(trip.id);
        setError("Perjalanan ini sudah pernah dinilai. Penilaian hanya bisa dikirim sekali.");
        tripService.getTrip(token, trip.id).then(onRated).catch(() => {});
      } else if (err instanceof ApiError && (err.isNetwork || err.status >= 500)) {
        setError(
          `${err.code === "timeout" ? err.message : NETWORK_ERROR_MESSAGE} Penilaian Anda tersimpan sebagai draf di perangkat ini — ketuk "Kirim penilaian" lagi kapan saja.`,
        );
      } else {
        setError(err instanceof ApiError ? err.message : "Penilaian belum terkirim. Draf Anda tetap tersimpan.");
      }
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    if (done) onRated(done);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
      >
        <View className="bg-surface rounded-t-3xl" style={{ maxHeight: "92%" }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            {done ? (
              <View className="gap-4 items-center py-4" accessibilityLiveRegion="polite">
                <Ionicons name="checkmark-circle" size={56} color="#065F46" />
                <Text className="text-ink text-xl text-center" weight="bold">
                  Terima kasih
                </Text>
                <Text className="text-ink-2 text-[15px] text-center" style={{ lineHeight: 22 }}>
                  Penilaian Anda tersimpan dan terlihat di Riwayat. Masukan ini kami pakai untuk mengecek ketepatan
                  perkiraan SmartRoute.
                </Text>
                <View className="w-full">
                  <PrimaryButton label="Tutup" onPress={close} />
                </View>
              </View>
            ) : (
              <>
                <View className="gap-1">
                  <Text className="text-ink text-xl" weight="bold" accessibilityRole="header">
                    Beri penilaian
                  </Text>
                  <Text className="text-ink-2 text-[15px]" numberOfLines={2}>
                    {trip.origin_label} → {trip.destination_label}
                  </Text>
                  {hadDraft && <Text className="text-ink-2 text-sm">Draf sebelumnya dipulihkan.</Text>}
                </View>

                <View className="gap-2">
                  <Text className="text-ink text-base" weight="bold">
                    Seberapa membantu rute ini? <Text style={{ color: "#B91C1C" }}>*</Text>
                  </Text>
                  <View className="flex-row gap-1" accessibilityRole="radiogroup" accessibilityLabel="Nilai bintang">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const filled = (draft.stars ?? 0) >= n;
                      return (
                        <Pressable
                          key={n}
                          onPress={() => update({ stars: n })}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: draft.stars === n }}
                          accessibilityLabel={`${n} dari 5 bintang`}
                          hitSlop={4}
                          style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}
                        >
                          <Ionicons name={filled ? "star" : "star-outline"} size={38} color={filled ? "#B45309" : "#737373"} />
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text className="text-ink-2 text-sm">
                    {draft.stars ? `${draft.stars} dari 5 bintang` : "Wajib diisi untuk mengirim."}
                  </Text>
                </View>

                {QUESTIONS.map((q) => (
                  <View key={q.key} className="gap-2">
                    <Text className="text-ink text-[15px]" weight="semibold">
                      {q.label}
                    </Text>
                    <View className="flex-row gap-2" accessibilityRole="radiogroup" accessibilityLabel={q.label}>
                      {ANSWERS.map((a) => {
                        const selected = draft[q.key] === a.value;
                        return (
                          <Pressable
                            key={a.label}
                            onPress={() => update({ [q.key]: a.value } as Partial<RatingDraft>)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selected }}
                            accessibilityLabel={`${q.label} ${a.label}`}
                            className="flex-1 rounded-xl items-center justify-center active:opacity-80"
                            style={{
                              minHeight: 48,
                              backgroundColor: selected ? BLUE : "#FFFFFF",
                              borderWidth: 1.5,
                              borderColor: selected ? BLUE : "#737373",
                            }}
                          >
                            <Text className="text-[15px]" weight="semibold" style={{ color: selected ? "#FFFFFF" : "#0A0A0A" }}>
                              {a.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}

                <View className="gap-1.5">
                  <Text className="text-ink text-[15px]" weight="semibold">
                    Pesan (opsional)
                  </Text>
                  <TextInput
                    value={draft.message}
                    onChangeText={(t) => update({ message: t.slice(0, MESSAGE_MAX) })}
                    maxLength={MESSAGE_MAX}
                    multiline
                    placeholder="Ceritakan pengalaman Anda, mis. halte transit yang membingungkan."
                    placeholderTextColor="#737373"
                    accessibilityLabel="Pesan, opsional, maksimal 500 karakter"
                    className="font-jakarta text-ink text-base bg-white rounded-xl px-4 py-3"
                    style={{ minHeight: 96, textAlignVertical: "top", borderWidth: 1, borderColor: "#737373" }}
                  />
                  <Text className="text-ink-2 text-xs text-right">
                    {draft.message.length}/{MESSAGE_MAX}
                  </Text>
                </View>

                {error && <FormMessage tone="error" message={error} />}

                <PrimaryButton
                  label={sending ? "Mengirim…" : "Kirim penilaian"}
                  onPress={submit}
                  loading={sending}
                  disabled={!draft.stars}
                  accessibilityHint={draft.stars ? undefined : "Pilih jumlah bintang terlebih dahulu."}
                />
                <PrimaryButton label="Nanti saja" variant="outline" onPress={close} disabled={sending} />
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

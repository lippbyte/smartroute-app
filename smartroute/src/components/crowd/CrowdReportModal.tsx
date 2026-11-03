// src/components/crowd/CrowdReportModal.tsx
//
// Task App-07: alur submit laporan kepadatan — dua langkah dalam satu
// modal: (1) cari & pilih halte (dilewati kalau pemanggil sudah tahu
// haltenya, mis. dari tap marker yang sudah tampil di peta), (2) pilih
// level kepadatan lalu submit. Struktur Modal+BlurView+Pressable-backdrop
// mengikuti pola yang sudah ada di PreferenceCard.tsx, tapi pakai palet
// gelap aplikasi ini (bg-surface/light-1) — bukan kartu putih PreferenceCard,
// supaya konsisten dengan layar Peta Kepadatan & hasil rute di sekitarnya.
import { useStopSearch } from "@/hooks/useStopSearch";
import {
  CrowdLevel,
  CrowdReportSubmitError,
  StopSearchResult,
  submitCrowdReport,
} from "@/services/crowdService";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Text from "../Text";
import { LEVEL_COLOR, LEVEL_LABEL } from "./crowdLevel";
import { t } from "@/i18n";

export interface CrowdReportTarget {
  gtfsId: string;
  name: string;
}

interface CrowdReportModalProps {
  visible: boolean;
  onClose: () => void;
  // Dipanggil setelah submit sukses — pemanggil yang bertanggung jawab
  // refresh data peta (lihat AC: marker harus langsung terlihat tanpa
  // reload manual).
  onSubmitted: () => void;
  // Kalau diisi, langkah pencarian dilewati — dipakai saat modal dibuka
  // dari tap marker/popup yang sudah tahu persis haltenya.
  initialStop?: CrowdReportTarget | null;
}

const LEVELS: CrowdLevel[] = ["low", "moderate", "high"];

export default function CrowdReportModal({
  visible,
  onClose,
  onSubmitted,
  initialStop,
}: CrowdReportModalProps) {
  const [selectedStop, setSelectedStop] = useState<CrowdReportTarget | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { results, isLoading } = useStopSearch(query);

  // Reset ke state awal setiap kali modal dibuka — supaya sisa pencarian
  // atau error dari sesi sebelumnya tidak nyangkut kalau user buka lagi.
  useEffect(() => {
    if (visible) {
      setSelectedStop(initialStop ?? null);
      setQuery("");
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialStop?.gtfsId]);

  const handlePickStop = (stop: StopSearchResult) => {
    setSelectedStop({ gtfsId: stop.gtfsId, name: stop.name });
  };

  const handleSubmit = async (level: CrowdLevel) => {
    if (!selectedStop) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitCrowdReport(selectedStop.gtfsId, level);
      onSubmitted();
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof CrowdReportSubmitError
          ? err.message
          : t("crowd.sendError"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill}>
        {/* bg-black/80, bukan /40 seperti pola aslinya (PreferenceCard) —
            blur dari expo-blur tidak sepenuhnya render di react-native-web,
            jadi backdrop perlu cukup gelap sendiri supaya konten di
            belakang modal tidak ikut kebaca dan bikin tampilan berantakan
            (ditemukan lewat screenshot verifikasi, bukan asumsi). */}
        <Pressable
          className="flex-1 justify-center items-center px-6 bg-black/80"
          onPress={onClose}
        >
          <Pressable
            onPress={() => {}}
            className="w-full max-w-[420px] max-h-[75%] bg-surface rounded-2xl overflow-hidden border border-line"
          >
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="text-ink font-bold text-lg">
                {selectedStop ? t("crowd.reportTitle") : t("crowd.findStop")}
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={22} color="#737373" />
              </Pressable>
            </View>

            {!selectedStop ? (
              // flex-shrink: di layar pendek (keyboard terbuka) daftar menyusut
              // di dalam kartu max-h-[75%], bukan terpotong di bawahnya.
              <View className="px-5 pb-5 gap-3 flex-shrink">
                <View className="flex-row items-center gap-2 bg-surface-2 rounded-xl px-3 py-2.5">
                  <Ionicons name="search" size={16} color="#737373" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t("crowd.searchPlaceholder")}
                    placeholderTextColor="#737373"
                    autoFocus
                    className="flex-1 font-jakarta text-ink text-md"
                  />
                  {isLoading && <ActivityIndicator size="small" color="#018959" />}
                </View>

                {query.trim().length > 0 && query.trim().length < 3 ? (
                  <Text className="text-muted text-sm text-center py-4">
                    {t("quick.minChars")}
                  </Text>
                ) : query.trim().length >= 3 && !isLoading && results.length === 0 ? (
                  <Text className="text-muted text-sm text-center py-4">
                    {t("crowd.noStops", { query: query.trim() })}
                  </Text>
                ) : (
                  // ScrollView, bukan View: dulu baris yang melebihi maxHeight
                  // terpotong (8 hasil "Monumen" di alur demo S2). "handled":
                  // keyboard terbuka saat daftar tampil (autoFocus), tanpa ini
                  // ketukan pertama hanya menutup keyboard.
                  <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                    {results.map((stop, index) => (
                      <Pressable
                        key={`${stop.gtfsId}-${index}`}
                        onPress={() => handlePickStop(stop)}
                        className="py-3 border-b border-line active:bg-surface-2"
                      >
                        <Text className="text-ink font-semibold text-md">
                          {stop.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              <View className="px-5 pb-5 gap-4">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="location" size={16} color="#018959" />
                  <Text className="text-ink font-bold text-md flex-1" numberOfLines={2}>
                    {selectedStop.name}
                  </Text>
                  {!initialStop && (
                    <Pressable onPress={() => setSelectedStop(null)} hitSlop={8}>
                      <Text className="text-primary-emerald text-xs font-bold">
                        {t("crowd.change")}
                      </Text>
                    </Pressable>
                  )}
                </View>

                <Text className="text-ink-2 text-sm">
                  {t("crowd.howCrowded")}
                </Text>

                <View className="gap-2.5">
                  {LEVELS.map((level) => (
                    <Pressable
                      key={level}
                      onPress={() => handleSubmit(level)}
                      disabled={isSubmitting}
                      className="flex-row items-center gap-3 bg-surface-2 rounded-xl px-4 py-3.5 active:opacity-80"
                      style={{ opacity: isSubmitting ? 0.6 : 1 }}
                    >
                      <View
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: LEVEL_COLOR[level],
                          borderWidth: 1.5,
                          borderColor: "#FFFFFF",
                        }}
                      />
                      <Text className="text-ink font-semibold text-md">
                        {LEVEL_LABEL[level]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {isSubmitting && (
                  <View className="flex-row items-center justify-center gap-2 py-1">
                    <ActivityIndicator size="small" color="#018959" />
                    <Text className="text-muted text-sm">{t("crowd.sending")}</Text>
                  </View>
                )}

                {submitError && (
                  <Text className="text-red-400 text-sm text-center">
                    {submitError}
                  </Text>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </BlurView>
    </Modal>
  );
}

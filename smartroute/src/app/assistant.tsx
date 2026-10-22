import ScreenBackground from "@/components/ScreenBackground";
// src/app/assistant.tsx
//
// Task App-22 + perluasan diminta user langsung (2026-09-10): UI Asisten AI
// (wayfinding chat). Riwayat percakapan disimpan HANYA dalam satu sesi layar
// ini — array di useState biasa, BUKAN AsyncStorage/persisten. Begitu layar
// di-unmount, riwayat hilang dan mulai bersih lagi kalau dibuka ulang.
//
// Perluasan 2026-09-23 (diminta user langsung): asisten tersambung dengan
// Halte Terdekat & cari-rute. Posisi GPS dibaca sekali saat layar dibuka dan
// dikirim bersama tiap pertanyaan; beberapa giliran terakhir ikut dikirim
// supaya pertanyaan lanjutan nyambung (backend sendiri tetap tidak menyimpan
// apa pun). Kalau jawabannya soal halte di sekitar, backend mengembalikan
// daftar halte yang ditampilkan sebagai kartu dengan tombol "Jalan ke sini" /
// "Berangkat dari sini".
import AssistantAnswerText from "@/components/assistant/AssistantAnswerText";
import Text from "@/components/Text";
import StopActionButtons from "@/components/transit/StopActionButtons";
import {
  MODE_COLOR,
  MODE_ICON,
  MODE_LABEL,
  formatDistance,
} from "@/components/transit/transitMode";
import {
  AssistantAskError,
  AssistantTurn,
  askAssistant,
} from "@/services/assistantService";
import { NearbyStop } from "@/services/nearbyStopsService";
import { getCurrentCoordinate } from "@/utils/currentLocation";
import { Coordinate, geocodePlace } from "@/utils/geocode";
import { formatCoordParam, MY_LOCATION_LABEL } from "@/utils/stopActions";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

const EXAMPLE_QUESTIONS = [
  "Halte terdekat dari saya di mana?",
  "Dari sini ke Monas naik apa?",
  "Dari Blok M ke Kota naik apa?",
  "Berapa tarif TransJakarta?",
];

// Giliran (tanya+jawab) yang ikut dikirim sebagai konteks — backend menolak
// lebih dari 10 pesan.
const MAX_HISTORY_MESSAGES = 8;
// Nominatim layanan gratis tanpa SLA — geocoding untuk grounding tidak boleh
// menahan pertanyaan terlalu lama; lewat dari ini asisten tetap ditanya
// tanpa rute konkret.
const GEOCODE_TIMEOUT_MS = 6000;

interface ResolvedRoute {
  originLabel: string;
  destinationLabel: string;
  originCoord: Coordinate | null;
  destinationCoord: Coordinate | null;
}

type ChatEntry =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; status: "loading" }
  | {
      id: string;
      role: "assistant";
      status: "success";
      answer: string;
      forQuestion: string;
      nearbyStops: NearbyStop[];
      route: ResolvedRoute | null;
    }
  | { id: string; role: "assistant"; status: "error"; message: string; forQuestion: string };

let nextId = 0;
function generateId(): string {
  nextId += 1;
  return `entry-${nextId}`;
}

// originText null = berangkat dari posisi GPS ("dari sini", atau "ke X naik
// apa" tanpa menyebut asal).
interface RouteQuery {
  originText: string | null;
  destinationText: string;
}

const SELF_ORIGIN = /^(sini|lokasi (saya|aku|ku)|posisi (saya|aku|ku)|tempat (saya|aku) sekarang)$/i;
const ROUTE_WORDS = /naik apa|pakai apa|\brute\b|caranya|cara ke|gimana ke|bagaimana ke/i;
// "gimana jalan ke halte terdekat" bukan pencarian rute ke tempat bernama
// "halte terdekat" — itu urusan kartu halte terdekat.
const NOT_A_PLACE = /terdekat|^(sana|sini|situ)$|^halte (ini|itu)$/i;

function cleanDestination(raw: string): string {
  return raw
    .trim()
    .replace(
      /\s*(naik apa|pakai apa|gimana(?:\s+caranya)?|bagaimana(?:\s+caranya)?)\b.*$/i,
      "",
    )
    .replace(/[?.!]+\s*$/, "")
    .trim();
}

function extractRouteQuery(question: string, hasGps: boolean): RouteQuery | null {
  const q = question.trim();
  const withOrigin = /dari\s+(.+?)\s+ke\s+(.+)/i.exec(q);
  if (withOrigin) {
    const originRaw = withOrigin[1].trim();
    const destinationText = cleanDestination(withOrigin[2]);
    if (!originRaw || !destinationText || NOT_A_PLACE.test(destinationText)) return null;
    return {
      originText: SELF_ORIGIN.test(originRaw) ? null : originRaw,
      destinationText,
    };
  }
  if (!hasGps || !ROUTE_WORDS.test(q)) return null;
  const toOnly = /\bke\s+(.+)/i.exec(q);
  if (!toOnly) return null;
  const destinationText = cleanDestination(toOnly[1]);
  if (!destinationText || NOT_A_PLACE.test(destinationText)) return null;
  return { originText: null, destinationText };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

async function resolveRouteQuery(
  query: RouteQuery,
  userLocation: Coordinate | null,
): Promise<ResolvedRoute> {
  const [originCoord, destinationCoord] = await Promise.all([
    query.originText === null
      ? Promise.resolve(userLocation)
      : withTimeout(geocodePlace(query.originText), GEOCODE_TIMEOUT_MS),
    withTimeout(geocodePlace(query.destinationText), GEOCODE_TIMEOUT_MS),
  ]);
  return {
    originLabel: query.originText ?? MY_LOCATION_LABEL,
    destinationLabel: query.destinationText,
    originCoord,
    destinationCoord,
  };
}

// Pasangan tanya-jawab yang berhasil saja; pertanyaan yang gagal dijawab
// tidak ikut, supaya model tidak melihat pertanyaan menggantung.
function buildHistory(entries: ChatEntry[]): AssistantTurn[] {
  const turns: AssistantTurn[] = [];
  for (let i = 0; i < entries.length - 1; i++) {
    const u = entries[i];
    const a = entries[i + 1];
    if (u.role === "user" && a.role === "assistant" && a.status === "success") {
      turns.push({ role: "user", content: u.text }, { role: "assistant", content: a.answer });
    }
  }
  return turns.slice(-MAX_HISTORY_MESSAGES);
}

function AiAvatar() {
  return (
    <View className="w-7 h-7 rounded-full bg-primary-emerald/20 items-center justify-center">
      <Ionicons name="sparkles" size={14} color="#018959" />
    </View>
  );
}

function StopCard({ stop, userLocation }: { stop: NearbyStop; userLocation: Coordinate | null }) {
  return (
    <View className="bg-surface-2/60 border border-line rounded-xl p-3 gap-2.5">
      <View className="flex-row items-center gap-2.5">
        <View
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${MODE_COLOR[stop.mode]}26` }}
        >
          <Ionicons name={MODE_ICON[stop.mode]} size={16} color={MODE_COLOR[stop.mode]} />
        </View>
        <View className="flex-1">
          <Text className="text-ink font-bold text-sm" numberOfLines={1}>
            {stop.name}
          </Text>
          <Text className="text-xs font-bold" style={{ color: MODE_COLOR[stop.mode] }}>
            {MODE_LABEL[stop.mode]}
          </Text>
        </View>
        <Text className="text-ink font-bold text-xs">{formatDistance(stop.distance_m)}</Text>
      </View>
      <StopActionButtons stop={stop} userLocation={userLocation} />
    </View>
  );
}

type LocationStatus = "locating" | "ready" | "unavailable";

export default function AssistantScreen() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("locating");

  useEffect(() => {
    let cancelled = false;
    getCurrentCoordinate().then((coordinate) => {
      if (cancelled) return;
      setUserLocation(coordinate);
      setLocationStatus(coordinate ? "ready" : "unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isBusy = entries.some(
    (e) => e.role === "assistant" && e.status === "loading",
  );

  const runQuestion = async (
    question: string,
    assistantId: string,
    history: AssistantTurn[],
  ) => {
    try {
      const parsed = extractRouteQuery(question, userLocation !== null);
      // "dari sini ke X" tanpa GPS tidak punya titik asal sama sekali.
      const routeQuery = parsed && (parsed.originText !== null || userLocation) ? parsed : null;
      const route = routeQuery ? await resolveRouteQuery(routeQuery, userLocation) : null;
      const reply = await askAssistant(question, {
        userLocation,
        origin: route?.originCoord,
        destination: route?.destinationCoord,
        history,
      });
      setEntries((prev) =>
        prev.map((e) =>
          e.id === assistantId
            ? {
                id: assistantId,
                role: "assistant",
                status: "success",
                answer: reply.answer,
                forQuestion: question,
                nearbyStops: reply.nearbyStops,
                route,
              }
            : e,
        ),
      );
    } catch (err) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === assistantId
            ? {
                id: assistantId,
                role: "assistant",
                status: "error",
                forQuestion: question,
                message:
                  err instanceof AssistantAskError || err instanceof Error
                    ? err.message
                    : "Gagal mendapat jawaban dari asisten.",
              }
            : e,
        ),
      );
    }
  };

  const handleAsk = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isBusy) return;
    const userId = generateId();
    const assistantId = generateId();
    const history = buildHistory(entries);
    setEntries((prev) => [
      ...prev,
      { id: userId, role: "user", text: trimmed },
      { id: assistantId, role: "assistant", status: "loading" },
    ]);
    runQuestion(trimmed, assistantId, history);
  };

  // Kirim ulang PERTANYAAN YANG SAMA ke bubble jawaban yang sama (bukan
  // nambah pasangan tanya-jawab baru) — konsisten dengan pola "retry pesan
  // gagal" di chat app pada umumnya, tidak menduplikasi bubble pertanyaan.
  const handleRetry = (assistantId: string, question: string) => {
    if (isBusy) return;
    const index = entries.findIndex((e) => e.id === assistantId);
    // Riwayat = semua yang terjadi SEBELUM pertanyaan yang di-retry.
    const history = buildHistory(entries.slice(0, Math.max(0, index - 1)));
    setEntries((prev) =>
      prev.map((e) =>
        e.id === assistantId ? { id: assistantId, role: "assistant", status: "loading" } : e,
      ),
    );
    runQuestion(question, assistantId, history);
  };

  const handleSubmit = () => {
    handleAsk(input);
    setInput("");
  };

  const openRoute = (route: ResolvedRoute) => {
    router.push({
      pathname: "/route",
      params: {
        origin: route.originLabel,
        destination: route.destinationLabel,
        ...(route.originCoord
          ? {
              originCoord: formatCoordParam(
                route.originCoord.latitude,
                route.originCoord.longitude,
              ),
            }
          : {}),
        ...(route.destinationCoord
          ? {
              destinationCoord: formatCoordParam(
                route.destinationCoord.latitude,
                route.destinationCoord.longitude,
              ),
            }
          : {}),
      },
    });
  };

  const locationHint =
    locationStatus === "locating"
      ? "Membaca lokasimu..."
      : locationStatus === "ready"
        ? "Lokasi aktif · tanya halte terdekat & rute"
        : "Lokasi tidak aktif · halte terdekat tidak tersedia";

  return (
    <ScreenBackground>
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-row items-center gap-3 px-5 pt-14 pb-3">
        <Pressable
          onPress={() => router.back()}
          className="bg-surface p-3 rounded-full"
        >
          <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-white font-bold text-lg">TOTO</Text>
          <Text className="text-[10px]" style={{ color: "#A3A3A3" }}>
            Transit Optimization Travel Orchestration
          </Text>
          <View className="flex-row items-center gap-1">
            <Ionicons
              name={locationStatus === "ready" ? "location" : "location-outline"}
              size={12}
              color={locationStatus === "ready" ? "#34D399" : "#D4D4D4"}
            />
            <Text className="text-xs" style={{ color: "#D4D4D4" }}>
              {locationHint}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="px-5 pb-6 gap-3"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {entries.length === 0 && (
          <View className="items-center gap-3 py-10 px-4">
            <Ionicons name="chatbubble-ellipses-outline" size={40} color="#737373" />
            <Text className="text-white text-center font-bold">
              Halo, aku TOTO! Mau ke mana hari ini?
            </Text>
            <Text className="text-line text-sm text-center">
              Tanya halte terdekat, rute, atau tarif. Jawabanku berdasarkan
              data transit asli dan posisimu — kalau datanya tidak ada, aku
              bilang jujur, bukan mengarang.
            </Text>
          </View>
        )}

        {entries.map((entry) => {
          if (entry.role === "user") {
            return (
              <View
                key={entry.id}
                className="bg-primary-emerald/25 rounded-2xl rounded-br-md px-4 py-2.5 self-end max-w-[85%]"
              >
                <Text className="text-ink text-sm font-semibold">{entry.text}</Text>
              </View>
            );
          }

          // Bubble asisten selalu didampingi avatar kecil di kiri — ciri
          // khas tampilan chat app (WhatsApp/Telegram-style), diminta user
          // langsung sebagai perluasan dari tampilan awal App-22.
          if (entry.status === "loading") {
            return (
              <View key={entry.id} className="flex-row items-end gap-2 self-start max-w-[85%]">
                <AiAvatar />
                <View className="flex-row items-center gap-2 bg-surface rounded-2xl rounded-bl-md px-4 py-3.5">
                  <ActivityIndicator size="small" color="#018959" />
                  <Text className="text-muted text-sm">TOTO sedang menjawab...</Text>
                </View>
              </View>
            );
          }

          if (entry.status === "error") {
            return (
              <View key={entry.id} className="flex-row items-end gap-2 self-start max-w-[85%]">
                <AiAvatar />
                <View className="bg-surface border border-red-500/30 rounded-2xl rounded-bl-md px-4 py-3.5 gap-2 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="warning-outline" size={16} color="#EF4444" />
                    <Text className="text-red-400 text-sm font-bold flex-1">
                      {entry.message}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRetry(entry.id, entry.forQuestion)}
                    disabled={isBusy}
                    className="bg-surface-2 self-start px-3 py-1.5 rounded-lg"
                    style={{ opacity: isBusy ? 0.5 : 1 }}
                  >
                    <Text className="text-ink text-xs font-bold">Coba Lagi</Text>
                  </Pressable>
                </View>
              </View>
            );
          }

          return (
            <View key={entry.id} className="flex-row items-end gap-2 self-start max-w-[90%]">
              <AiAvatar />
              <View className="bg-surface rounded-2xl rounded-bl-md px-4 py-3.5 gap-3 flex-1">
                <AssistantAnswerText text={entry.answer} />
                {entry.nearbyStops.map((stop, i) => (
                  <StopCard
                    key={`${stop.mode}-${stop.name}-${i}`}
                    stop={stop}
                    userLocation={userLocation}
                  />
                ))}
                {entry.route && (
                  <Pressable
                    onPress={() => openRoute(entry.route!)}
                    className="flex-row items-center justify-center gap-2 bg-[#018959] py-2.5 rounded-xl active:opacity-80"
                  >
                    <Ionicons name="navigate" size={16} color="#FFFFFF" />
                    <Text className="text-white font-bold text-sm">
                      Lihat Hasil Rute & Navigasi
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

        {entries.length === 0 && (
          <View className="gap-2">
            <Text className="text-line text-xs">Contoh pertanyaan:</Text>
            <View className="flex-row flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => handleAsk(q)}
                  className="bg-surface border border-line px-3 py-2 rounded-full"
                >
                  <Text className="text-ink-2 text-xs">{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Perluasan diminta user langsung: kotak ketik didesain ulang jadi
          satu pill menyatu (input + tombol kirim dalam satu wadah), gaya
          yang lebih umum dipakai chat app (WhatsApp/iMessage-style) —
          sebelumnya dua elemen terpisah bersebelahan. */}
      <View className="px-5 pb-8 pt-2">
        <View className="flex-row items-end gap-1.5 bg-surface rounded-3xl pl-4 pr-1.5 py-1.5 border border-line">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Tanya TOTO..."
            placeholderTextColor="#737373"
            multiline
            className="flex-1 font-jakarta text-ink text-sm py-2 max-h-24"
            // Web (react-native-web) menampilkan outline fokus default
            // browser berbentuk kotak siku yang menimpa bentuk pill bulat
            // dari container-nya — dimatikan khusus di web, tidak
            // berpengaruh di native (iOS/Android tidak kenal properti ini).
            style={Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : undefined}
            editable={!isBusy}
            onSubmitEditing={handleSubmit}
            // Di web, TextInput multiline tidak memicu onSubmitEditing saat
            // Enter ditekan (Enter cuma menyisipkan baris baru). Tangani
            // manual: Enter saja -> kirim pesan, Shift+Enter -> baris baru
            // (perilaku standar chat app desktop).
            onKeyPress={(e) => {
              if (Platform.OS !== "web") return;
              const nativeEvent = e.nativeEvent as unknown as {
                key?: string;
                shiftKey?: boolean;
              };
              if (nativeEvent.key === "Enter" && !nativeEvent.shiftKey) {
                (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                handleSubmit();
              }
            }}
          />
          <Pressable
            onPress={handleSubmit}
            disabled={isBusy || input.trim().length === 0}
            accessibilityLabel="Kirim pertanyaan"
            className="bg-[#018959] w-10 h-10 rounded-full items-center justify-center active:opacity-80"
            style={{ opacity: isBusy || input.trim().length === 0 ? 0.5 : 1 }}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={16} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

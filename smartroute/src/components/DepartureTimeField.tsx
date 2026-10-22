// src/components/DepartureTimeField.tsx
//
// Task App-08: input jam keberangkatan sederhana — sengaja BUKAN calendar
// picker penuh (di luar lingkup task ini). Toggle "Sekarang"/"Atur waktu"
// + dua kotak angka jam:menit, tanggal selalu hari ini (tidak ada UI
// tanggal sama sekali, sesuai batasan eksplisit task).
import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import Text from "./Text";

export interface DepartureTimeValue {
  enabled: boolean;
  hour: string;
  minute: string;
}

export const DEFAULT_DEPARTURE_TIME: DepartureTimeValue = {
  enabled: false,
  hour: "",
  minute: "",
};

interface DepartureTimeFieldProps {
  value: DepartureTimeValue;
  onChange: (value: DepartureTimeValue) => void;
}

function onlyDigits(text: string, maxLen: number): string {
  return text.replace(/[^0-9]/g, "").slice(0, maxLen);
}

// Task App-16: batasi jam ke rentang valid SAAT DIKETIK, bukan cuma
// divalidasi setelah submit (validateHourMinute di utils/departureTime.ts
// tetap ada sebagai jaring pengaman terakhir kalau nilai sampai ke sana
// lewat jalan lain, tapi field ini sendiri sekarang tidak pernah
// menampilkan >23 sama sekali). Clamp ke "23" (bukan tolak keystroke-nya)
// begitu 2 digit membentuk angka >23 — mis. ketik "2" lalu "9" jadi "23",
// bukan diam-diam menolak digit "9"-nya (yang terasa seperti field tidak
// merespons input).
function clampHourText(text: string): string {
  const digits = onlyDigits(text, 2);
  if (digits.length < 2) return digits;
  return Number(digits) > 23 ? "23" : digits;
}

export default function DepartureTimeField({
  value,
  onChange,
}: DepartureTimeFieldProps) {
  // Task App-16: dipakai kolom jam untuk pindah fokus otomatis ke kolom ini
  // begitu 2 digit selesai diketik — pola familiar ala input OTP/kode
  // verifikasi (per tujuan task), mengurangi satu tap manual.
  const minuteInputRef = useRef<TextInput>(null);

  return (
    <View className="w-full bg-surface-2 px-4 py-4 rounded-xl gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="time-outline" size={19} color="#404040" />
          <Text className="text-ink-2 text-md">Waktu Berangkat</Text>
        </View>
        <Pressable
          onPress={() => onChange({ ...value, enabled: !value.enabled })}
          className={`px-3 py-1.5 rounded-full ${value.enabled ? "bg-surface border border-line" : "bg-brand-blue"}`}
        >
          <Text
            className={`text-xs font-bold ${value.enabled ? "text-ink-2" : "text-white"}`}
          >
            {value.enabled ? "Sekarang" : "Atur waktu"}
          </Text>
        </Pressable>
      </View>

      {value.enabled && (
        <View className="flex-row items-center gap-2">
          <TextInput
            value={value.hour}
            onChangeText={(h) => {
              const hour = clampHourText(h);
              onChange({ ...value, hour });
              // Task App-16: auto-pindah fokus begitu 2 digit selesai —
              // clampHourText menjamin string di sini TIDAK PERNAH lebih
              // dari 2 karakter, jadi "length === 2" persis berarti "user
              // baru saja mengetik digit kedua", bukan sisa dari nilai lama
              // yang sudah 2 digit (onChangeText cuma jalan saat teks
              // benar-benar berubah).
              if (hour.length === 2) {
                minuteInputRef.current?.focus();
              }
            }}
            placeholder="07"
            placeholderTextColor="#737373"
            keyboardType="number-pad"
            maxLength={2}
            className="bg-surface font-jakarta text-ink font-bold text-lg text-center rounded-lg px-3 py-2 w-16"
          />
          <Text className="text-ink font-bold text-lg">:</Text>
          <TextInput
            ref={minuteInputRef}
            value={value.minute}
            onChangeText={(m) => onChange({ ...value, minute: onlyDigits(m, 2) })}
            placeholder="00"
            placeholderTextColor="#737373"
            keyboardType="number-pad"
            maxLength={2}
            className="bg-surface font-jakarta text-ink font-bold text-lg text-center rounded-lg px-3 py-2 w-16"
          />
          <Text className="text-muted text-xs ml-1">hari ini</Text>
        </View>
      )}
    </View>
  );
}

// src/components/form/FormField.tsx
//
// Hari 1 Task 2: field form untuk layar Masuk/Daftar — label selalu
// terlihat (bukan hanya placeholder), galat di bawah field, ramah semua umur.
// Kontras (WCAG AA) di atas kartu putih #F8FAFC:
//   label #404040 ~10:1, teks #0A0A0A ~19:1, placeholder/hint #737373 ~4.6:1,
//   garis input #737373 (>= 3:1 untuk komponen non-teks), galat #B91C1C ~6.3:1.
import Text from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useState } from "react";
import { Pressable, TextInput, TextInputProps, View } from "react-native";

export const FORM_ERROR_COLOR = "#B91C1C";

interface FormFieldProps extends Omit<TextInputProps, "style" | "className"> {
  label: string;
  error?: string | null;
  hint?: string;
  /** Tampilkan tombol mata untuk melihat/menyembunyikan kata sandi. */
  secureToggle?: boolean;
}

const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, error, hint, secureToggle, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? FORM_ERROR_COLOR : focused ? "#0F3FC1" : "#737373";

  return (
    <View className="gap-1.5">
      <Text className="text-ink-2 text-[15px]" weight="semibold">
        {label}
      </Text>
      <View
        className="flex-row items-center bg-white rounded-xl"
        style={{ borderWidth: focused || error ? 2 : 1, borderColor, minHeight: 52 }}
      >
        <TextInput
          ref={ref}
          {...inputProps}
          secureTextEntry={secureToggle ? hidden : inputProps.secureTextEntry}
          placeholderTextColor="#737373"
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          className="flex-1 font-jakarta text-ink text-base px-4 py-3"
        />
        {secureToggle && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Tampilkan kata sandi" : "Sembunyikan kata sandi"}
            className="px-4 py-3"
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={22} color="#404040" />
          </Pressable>
        )}
      </View>
      {error ? (
        <View className="flex-row items-start gap-1.5" accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={16} color={FORM_ERROR_COLOR} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm" style={{ color: FORM_ERROR_COLOR }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text className="text-muted text-sm">{hint}</Text>
      ) : null}
    </View>
  );
});

export default FormField;

/** Kotak pesan di atas tombol utama: galat umum (jaringan, kredensial)
 *  atau info (sesi berakhir). */
export function FormMessage({ tone, message }: { tone: "error" | "info"; message: string }) {
  const isError = tone === "error";
  return (
    <View
      className="flex-row items-start gap-2 rounded-xl px-4 py-3"
      style={{
        backgroundColor: isError ? "#FEF2F2" : "#FFF7ED",
        borderWidth: 1,
        borderColor: isError ? "#FCA5A5" : "#FDBA74",
      }}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Ionicons
        name={isError ? "alert-circle" : "information-circle"}
        size={20}
        color={isError ? FORM_ERROR_COLOR : "#9A3412"}
        style={{ marginTop: 1 }}
      />
      <Text className="flex-1 text-[15px]" style={{ color: isError ? "#7F1D1D" : "#7C2D12" }}>
        {message}
      </Text>
    </View>
  );
}

// src/app/login.tsx
//
// Hari 1 Task 2: layar Masuk. Muncul saat app dibuka tanpa sesi dan tanpa
// pilihan tamu, setelah Keluar, dan saat sesi berakhir (dengan pesan).
// "Lanjut sebagai tamu" selalu terlihat — login bukan syarat memakai fitur
// inti (aturan main no. 1).
import AuthScreenLayout from "@/components/form/AuthScreenLayout";
import FormField, { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import Text from "@/components/Text";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, continueAsGuest, notice, clearNotice } = useAuth();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dibuka dari Profil (tamu) -> kembali ke sana; dibuka saat app mulai ->
  // ke Beranda.
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const submit = async () => {
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = "Email wajib diisi.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Format email tidak valid, contoh: nama@email.com";
    if (!password) errors.password = "Kata sandi wajib diisi.";
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    clearNotice();
    try {
      await signIn(email, password);
      leave();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const guest = async () => {
    await continueAsGuest();
    leave();
  };

  return (
    <AuthScreenLayout
      title="Masuk"
      subtitle="Masuk untuk menyimpan riwayat perjalanan dan memakai TOTO, asisten AI."
      footer={<PrimaryButton label="Lanjut sebagai tamu" variant="ghost-light" onPress={guest} accessibilityHint="Langsung ke Beranda tanpa akun. Pencarian rute tetap bisa dipakai." />}
    >
      {notice && <FormMessage tone="info" message={notice} />}

      <FormField
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: undefined }));
        }}
        error={fieldErrors.email}
        placeholder="nama@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <FormField
        ref={passwordRef}
        label="Kata sandi"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
        }}
        error={fieldErrors.password}
        secureToggle
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      {formError && <FormMessage tone="error" message={formError} />}

      <PrimaryButton label={submitting ? "Memproses…" : "Masuk"} onPress={submit} loading={submitting} />

      <View className="flex-row justify-center items-center flex-wrap gap-1">
        <Text className="text-ink-2 text-[15px]">Belum punya akun?</Text>
        <Pressable onPress={() => router.replace("/register")} hitSlop={8} accessibilityRole="link">
          <Text className="text-[15px] underline" weight="bold" style={{ color: "#0F3FC1" }}>
            Daftar
          </Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}

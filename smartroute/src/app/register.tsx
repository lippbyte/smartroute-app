// src/app/register.tsx
//
// Hari 1 Task 2: layar Daftar. Galat dari server (mis. email sudah dipakai)
// ditampilkan di bawah field yang bersangkutan, bukan hanya di atas form.
import AuthScreenLayout from "@/components/form/AuthScreenLayout";
import FormField, { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import Text from "@/components/Text";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { t } from "@/i18n";

type Field = "name" | "email" | "password";

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, continueAsGuest } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [values, setValues] = useState<Record<Field, string>>({ name: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const set = (field: Field) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    if (fieldErrors[field]) setFieldErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = async () => {
    const errors: Partial<Record<Field, string>> = {};
    if (!values.name.trim()) errors.name = t("auth.nameRequired");
    if (!values.email.trim()) errors.email = t("auth.emailRequired");
    else if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = t("auth.emailInvalid");
    if (values.password.length < 8) errors.password = t("auth.passwordMin");
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await signUp({ name: values.name.trim(), email: values.email, password: values.password });
      // Task 3: lanjut ke onboarding preferensi (semua langkahnya bisa
      // dilewati). replace: tombol back tidak kembali ke form Daftar.
      router.replace("/onboarding");
    } catch (err) {
      if (err instanceof ApiError) {
        const serverFields: Partial<Record<Field, string>> = {};
        for (const f of ["name", "email", "password"] as const) if (err.fields[f]) serverFields[f] = err.fields[f];
        setFieldErrors(serverFields);
        // Pesan umum hanya kalau tidak ada galat per field yang menjelaskan.
        if (!Object.keys(serverFields).length) setFormError(err.message);
      } else {
        setFormError(t("common.genericError"));
      }
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
      title={t("common.signUp")}
      subtitle={t("auth.signUpSubtitle")}
      footer={<PrimaryButton label={t("common.continueGuest")} variant="ghost-light" onPress={guest} accessibilityHint={t("common.guestHint")} />}
    >
      <FormField
        label={t("auth.nickname")}
        value={values.name}
        onChangeText={set("name")}
        error={fieldErrors.name}
        placeholder={t("auth.nicknamePlaceholder")}
        autoComplete="name"
        textContentType="nickname"
        maxLength={60}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <FormField
        ref={emailRef}
        label="Email"
        value={values.email}
        onChangeText={set("email")}
        error={fieldErrors.email}
        placeholder={t("auth.emailPlaceholder")}
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
        label={t("auth.password")}
        value={values.password}
        onChangeText={set("password")}
        error={fieldErrors.password}
        hint={t("auth.passwordHint")}
        secureToggle
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      {formError && <FormMessage tone="error" message={formError} />}

      <PrimaryButton label={submitting ? t("common.processing") : t("common.signUp")} onPress={submit} loading={submitting} />

      <View className="flex-row justify-center items-center flex-wrap gap-1">
        <Text className="text-ink-2 text-[15px]">{t("auth.haveAccount")}</Text>
        <Pressable onPress={() => router.replace("/login")} hitSlop={8} accessibilityRole="link">
          <Text className="text-[15px] underline" weight="bold" style={{ color: "#0F3FC1" }}>
            {t("common.signIn")}
          </Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}

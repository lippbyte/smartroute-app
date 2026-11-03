// src/services/authService.ts
//
// Hari 1 Task 2/3: akun & preferensi. Bentuk data dicerminkan manual dari
// backend (backend-skeleton/src/services/users.ts & lib/validation.ts) —
// sama seperti service lain, kedua proyek tidak berbagi workspace.
import { apiRequest } from "./apiClient";
import { t } from "@/i18n";

// Label sama dengan chip kriteria di layar hasil ("Tenang", bukan "Nyaman").
// "sehat" ditambahkan Hari 2 (harus sama dengan backend lib/validation.ts) —
// hanya disimpan + konteks TOTO; TIDAK ada chip "Sehat" dan urutan hasil
// tidak berubah.
export const PRIORITIES = ["cepat", "murah", "tenang", "sehat"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const WALK_LIMITS = ["dekat", "sedang", "jauh"] as const;
export type WalkLimit = (typeof WALK_LIMITS)[number];
export const AVOIDABLE_MODES = ["bus", "krl", "mrt", "lrt"] as const;
export type AvoidableMode = (typeof AVOIDABLE_MODES)[number];
export const ACCESSIBILITY_NEEDS = ["kursi_roda", "low_vision", "tunarungu", "kognitif", "lansia_anak"] as const;
export type AccessibilityNeed = (typeof ACCESSIBILITY_NEEDS)[number];

export interface UserPreferences {
  priority?: Priority | null;
  walk_limit?: WalkLimit | null;
  avoid_modes?: AvoidableMode[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  preferences: UserPreferences;
  accessibility: { needs: AccessibilityNeed[]; consent_at: string } | null;
  created_at: string;
}

export interface SessionResponse {
  token: string;
  expires_at: string;
  user: AuthUser;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  preferences?: UserPreferences;
  accessibility?: { needs: AccessibilityNeed[]; consent: true };
}

export function register(input: RegisterInput): Promise<SessionResponse> {
  return apiRequest("POST", "/auth/register", {
    body: input,
    timeoutMessage: t("auth.timeoutRegister"),
  });
}

export function login(email: string, password: string): Promise<SessionResponse> {
  return apiRequest("POST", "/auth/login", {
    body: { email, password },
    timeoutMessage: t("auth.timeoutLogin"),
  });
}

export function logout(token: string): Promise<void> {
  return apiRequest("POST", "/auth/logout", {
    token,
    timeoutMs: 5_000,
    timeoutMessage: t("auth.timeoutLogout"),
  });
}

export function fetchMe(token: string): Promise<AuthUser> {
  return apiRequest("GET", "/me", { token, timeoutMessage: t("auth.timeoutProfile") });
}

export function updatePreferences(token: string, preferences: UserPreferences): Promise<AuthUser> {
  return apiRequest("PUT", "/me/preferences", {
    token,
    body: preferences,
    timeoutMessage: t("auth.timeoutPrefs"),
  });
}

export function saveAccessibility(token: string, needs: AccessibilityNeed[]): Promise<AuthUser> {
  return apiRequest("PUT", "/me/accessibility", {
    token,
    body: { needs, consent: true },
    timeoutMessage: t("auth.timeoutA11ySave"),
  });
}

export function deleteAccessibility(token: string): Promise<AuthUser> {
  return apiRequest("DELETE", "/me/accessibility", {
    token,
    timeoutMessage: t("auth.timeoutA11yDelete"),
  });
}

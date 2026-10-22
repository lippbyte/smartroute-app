// src/services/apiConfig.ts
//
// Shared backend base URL, used by every service that calls the real
// backend (routeService.ts, crowdService.ts, ...) — factored out here so the
// resolution logic lives in exactly one place.
//
// localhost bekerja untuk web & iOS simulator. Emulator Android butuh
// 10.0.2.2 (alias localhost host-nya dari dalam emulator). Device fisik:
// set EXPO_PUBLIC_API_BASE_URL ke IP LAN komputer yang menjalankan backend,
// mis. "http://192.168.1.5:3000" — localhost/10.0.2.2 tidak akan terjangkau
// dari device fisik.
import { Platform } from "react-native";

const DEFAULT_BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL;

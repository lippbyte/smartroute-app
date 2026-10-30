// Stub minimal "react-native" & "@expo/vector-icons" untuk menjalankan
// service app (TypeScript asli) di Node saat uji — lihat register-stubs.mjs.
// Hanya yang dipakai service: Platform.OS (apiConfig.ts).
export const Platform = { OS: "web", select: (o) => o.web ?? o.default };
export const Ionicons = { glyphMap: {} };
export default { Platform };

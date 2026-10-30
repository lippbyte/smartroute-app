// Hari 2: arahkan "react-native" & "@expo/vector-icons" ke stub saat service
// app (TypeScript asli) dijalankan di Node untuk uji pipeline. Memakai
// module.registerHooks (Node >= 22.15) karena hook ini berlaku untuk import
// MAUPUN require — tsx mengubah file .ts app ke CommonJS. Pakai bersama
// loader tsx, stub didaftarkan lebih dulu:
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs <skrip.mts>
import { registerHooks } from "node:module";

const STUBS = {
  "react-native": "./rn-stub.mjs",
  "@expo/vector-icons": "./rn-stub.mjs",
  // Hari 3: AsyncStorage berbasis berkas (lihat asyncstorage-stub.mjs).
  "@react-native-async-storage/async-storage": "./asyncstorage-stub.mjs",
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stub = STUBS[specifier];
    if (stub) return { url: new URL(stub, import.meta.url).href, format: "module", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

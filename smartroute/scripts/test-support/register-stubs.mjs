// Hari 2: arahkan "react-native" & "@expo/vector-icons" ke stub saat service
// app (TypeScript asli) dijalankan di Node untuk uji pipeline. Memakai
// module.registerHooks (Node >= 22.15) karena hook ini berlaku untuk import
// MAUPUN require — tsx mengubah file .ts app ke CommonJS. Pakai bersama
// loader tsx, stub didaftarkan lebih dulu:
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs <skrip.mts>
import { registerHooks } from "node:module";

const STUBBED = new Set(["react-native", "@expo/vector-icons"]);
const stubUrl = new URL("./rn-stub.mjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (STUBBED.has(specifier)) return { url: stubUrl, format: "module", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

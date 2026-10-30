// Hari 3 Task 3: uji Trip Pass dengan KODE ASLI app.
//
//   fase "main"   : tarif per segmen (HTTP -> adapter) = cost_idr backend untuk
//                   S1 & rute campuran; logika saldo/top-up; top-up disimpan;
//                   NOL panggilan jaringan selama operasi saldo/top-up.
//   fase "reopen" : proses Node BARU (= app dibuka ulang) membaca saldo yang
//                   ditulis fase main dari penyimpanan perangkat.
//
// Jalankan dari smartroute/ (backend :3000), dengan ASYNC_STORAGE_FILE sama:
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs scripts/test-trip-pass.mts main
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs scripts/test-trip-pass.mts reopen
import { adaptToLegacyShape, fetchRealRoutes } from "../src/services/routeService";
import {
  applyTopUp,
  checkBalance,
  DEFAULT_BALANCE,
  loadBalance,
  MAX_BALANCE,
  parseBalanceInput,
  saveBalance,
  TOPUP_OPTIONS,
} from "../src/utils/tripPassWallet";

const PHASE = process.argv[2] ?? "main";
const AT = "2026-09-21T07:30:00+07:00";
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

if (PHASE === "main") {
  // --- 1. Tarif: HTTP -> adapter; rincian = cost_idr backend.
  const cases = {
    S1: [{ lat: -6.2444643, lng: 106.7981332 }, { lat: -6.1355, lng: 106.8165 }],
    PB: [{ lat: -6.1622, lng: 106.8347 }, { lat: -6.2892744, lng: 106.7749355 }],
    L2: [{ lat: -6.3738927, lng: 106.8956692 }, { lat: -6.2287849, lng: 106.8332025 }],
  } as const;
  for (const [id, [o, d]] of Object.entries(cases)) {
    const raw = await fetchRealRoutes(o, d, AT);
    const routes = adaptToLegacyShape(raw).routes;
    for (const [i, r] of routes.entries()) {
      const items = r.fare_breakdown ?? [];
      const sum = items.reduce((s, it) => s + (it.fare_idr ?? 0), 0);
      const legsCovered = new Set(items.flatMap((it) => it.leg_indexes));
      const transitLegs = raw.routes[i].legs.map((l, k) => [l.mode, k] as const).filter(([m]) => m !== "WALK").map(([, k]) => k);
      check(
        `T1 ${id}/${r.route_id}: total Trip Pass ${r.cost_idr} = backend ${raw.routes[i].cost_idr} = jumlah ${items.length} segmen`,
        r.cost_idr === raw.routes[i].cost_idr && sum === r.cost_idr && items.length > 0 && transitLegs.every((k) => legsCovered.has(k)),
        items.map((it) => `${it.label}=${it.fare_idr}`).join(" + "),
      );
    }
  }

  // Rute campuran: struktur segmen sesuai aturan gerbang.
  const pb = adaptToLegacyShape(await fetchRealRoutes(cases.PB[0], cases.PB[1], AT)).routes;
  const busMrt = pb.find((r) => r.route_id === "2+1+M")!;
  const krlMrt = pb.find((r) => r.route_id === "Bogor+Cikarang+M")!;
  check(
    "T2 2+1+M: dua bus reguler = SATU segmen TransJakarta (transfer gratis) + satu segmen MRT",
    busMrt.fare_breakdown!.filter((i) => i.operator === "TransJakarta").length === 1 &&
      busMrt.fare_breakdown!.find((i) => i.operator === "TransJakarta")!.leg_indexes.length === 2 &&
      busMrt.fare_breakdown!.filter((i) => i.operator === "MRT").length === 1,
  );
  check(
    "T3 Bogor+Cikarang+M: ganti lin KRL di dalam gerbang = SATU segmen KRL + satu segmen MRT",
    krlMrt.fare_breakdown!.filter((i) => i.operator === "KRL").length === 1 &&
      krlMrt.fare_breakdown!.find((i) => i.operator === "KRL")!.leg_indexes.length === 2 &&
      krlMrt.fare_breakdown!.filter((i) => i.operator === "MRT").length === 1,
  );

  // --- 2. Logika saldo (murni) & 3. tanpa jaringan.
  let netCalls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    netCalls++;
    return realFetch(...args);
  }) as typeof fetch;

  const total = busMrt.cost_idr;
  check(`T4 saldo kurang -> "Kurang", selisih benar`, JSON.stringify(checkBalance(10_000, total)) === JSON.stringify({ status: "kurang", shortfall: total - 10_000 }), `total ${total}`);
  check("T5 saldo cukup -> 'Cukup', sisa benar", JSON.stringify(checkBalance(50_000, total)) === JSON.stringify({ status: "cukup", remaining: 50_000 - total }));
  check("T6 saldo tepat sama -> 'Cukup' sisa 0", JSON.stringify(checkBalance(total, total)) === JSON.stringify({ status: "cukup", remaining: 0 }));
  check("T7 top-up nominal pilihan menambah saldo", applyTopUp(10_000, 20_000) === 30_000);
  check("T8 top-up nominal di luar pilihan ditolak", applyTopUp(10_000, 15_000) === null && applyTopUp(10_000, -10_000) === null);
  check("T9 top-up melewati batas simulasi ditolak", applyTopUp(MAX_BALANCE - 5_000, TOPUP_OPTIONS[0]) === null);
  check("T10 input saldo awal: 'Rp 25.000' -> 25000; teks asing/terlalu besar -> null", parseBalanceInput("Rp 25.000") === 25_000 && parseBalanceInput("abc") === null && parseBalanceInput(String(MAX_BALANCE + 1)) === null);

  check("T11 belum pernah disimpan -> saldo bawaan", (await loadBalance()) === DEFAULT_BALANCE, `${DEFAULT_BALANCE}`);
  const afterTopUp = applyTopUp(await loadBalance(), 50_000)!;
  await saveBalance(afterTopUp);
  check("T12 top-up tersimpan", (await loadBalance()) === DEFAULT_BALANCE + 50_000, `${afterTopUp}`);
  globalThis.fetch = realFetch;
  check("T13 NOL panggilan jaringan selama cek saldo/top-up/simpan", netCalls === 0, `${netCalls} panggilan`);
} else {
  // --- 4. App dibuka ulang (proses baru).
  check("T14 proses baru membaca saldo simulasi yang sudah di-top-up", (await loadBalance()) === DEFAULT_BALANCE + 50_000);
}

console.log(failures === 0 ? `\nSemua uji Trip Pass fase '${PHASE}' lulus.` : `\n${failures} uji GAGAL di fase '${PHASE}'.`);
process.exitCode = failures ? 1 : 0;

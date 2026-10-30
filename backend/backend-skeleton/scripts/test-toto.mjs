// Hari 1 Task 4: jalankan pertanyaan TOTO yang sudah lulus sebelumnya
// (README Backend-06 #1-#5 + contoh dokumen Hari 1) dan catat latensi.
//
//   node scripts/test-toto.mjs <baseUrl> <out.json> [--demo]
//
// --demo: masuk dulu dengan akun demo (data/demo-account.local.json) dan
// kirim token — wajib sejak /assistant/ask butuh login. Kredensial & token
// tidak dicetak. Setiap pertanyaan = satu panggilan OpenRouter berbayar.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , BASE = "http://localhost:3000", OUT = "toto.json", ...flags] = process.argv;

export const QUESTIONS = [
  { id: "Q1", question: "dari Blok M ke Kota naik apa?", expect: "menyebut Rute 1 (BRT), Rp3.500" },
  { id: "Q2", question: "Berapa tarif TransJakarta?", expect: "tingkatan tarif Rp3.500 / Rp20.000 Royaltrans / Rp35.000" },
  { id: "Q3", question: "Jam berapa TransJakarta mulai dan berhenti beroperasi?", expect: "05:00-22:00 WIB, disebut rentang umum" },
  { id: "Q4", question: "Dari Kalideres ke PGC naik koridor berapa?", expect: "jujur tidak ada rute langsung, tidak mengarang" },
  {
    id: "Q5",
    question: "Berapa lama perjalanannya dan apakah ramai?",
    context: { origin: { lat: -6.243312, lng: 106.80175 }, destination: { lat: -6.13679, lng: 106.8149 } },
    expect: "waktu tempuh sesuai /routes Blok M -> Kota; jujur soal data kepadatan",
  },
  { id: "Q6", question: "Dari Fatmawati ke Manggarai naik apa?", expect: "menyebut MRT + KRL" },
];

async function demoToken() {
  const creds = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "data", "demo-account.local.json"), "utf8"));
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  if (!res.ok) throw new Error(`login akun demo gagal: HTTP ${res.status}`);
  return (await res.json()).token;
}

const token = flags.includes("--demo") ? await demoToken() : null;
const results = [];
for (const q of QUESTIONS) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/assistant/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ question: q.question, ...(q.context ? { context: q.context } : {}) }),
  });
  const body = await res.json().catch(() => null);
  const ms = Date.now() - t0;
  results.push({ ...q, http: res.status, ms, answer: body?.answer ?? null, error: body?.error ?? null });
  console.log(`${q.id}  HTTP ${res.status}  ${String(ms).padStart(6)} ms  ${(body?.answer ?? body?.message ?? "").replace(/\s+/g, " ").slice(0, 110)}`);
}
writeFileSync(OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), withToken: !!token, results }, null, 2));
console.log(`-> ${OUT}`);

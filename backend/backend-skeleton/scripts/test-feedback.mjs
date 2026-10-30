// Hari 3 Task 4: uji POST /feedback.
//
//   node scripts/test-feedback.mjs <baseUrl> [tunnelUrl]
//
// IP klien disimulasikan lewat X-Forwarded-For (request loopback dipercaya
// backend — trust proxy loopback), jadi tiap uji memakai "kantong" rate
// limit sendiri. Penyimpanan dicek LANGSUNG di file database. Pesan uji
// diberi awalan "[uji]".
import { randomBytes } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [, , BASE = "http://localhost:3000", TUNNEL] = process.argv;
const tag = randomBytes(4).toString("hex");
const ip = (n) => `198.51.100.${n}`;
let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
async function send(body, { token, from, base = BASE } = {}) {
  const res = await fetch(`${base}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "1",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(from ? { "X-Forwarded-For": from } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const db = new DatabaseSync(path.join(import.meta.dirname, "..", "data", "smartroute.db"), { readOnly: true });
const row = (id) => db.prepare("SELECT user_id, category, message, app_version FROM feedback WHERE id = ?").get(id);
const msg = (s) => `[uji ${tag}] ${s}`;

// 1. Tamu.
const g = await send({ category: "saran_fitur", message: msg("tamu"), app_version: "1.0.0" }, { from: ip(10) });
const gRow = g.json?.id && row(g.json.id);
check("F1 tamu kirim -> 201, tersimpan di DB tanpa akun", g.status === 201 && g.json.linked_to_account === false && gRow?.user_id === null && gRow?.message === msg("tamu") && gRow?.app_version === "1.0.0", `HTTP ${g.status}`);

// 2. Pengguna login -> tertaut akun.
const reg = await fetch(`${BASE}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: `masukan-${tag}@contoh.test`, password: randomBytes(12).toString("base64url"), name: "Uji Masukan" }),
}).then((r) => r.json());
const u = await send({ category: "rute_tidak_tepat", message: msg("login") }, { token: reg.token, from: ip(11) });
check("F2 pengguna login -> 201, user_id di DB = akun itu", u.status === 201 && u.json.linked_to_account === true && row(u.json.id)?.user_id === reg.user.id, `HTTP ${u.status}`);

// 3. Validasi.
const long = await send({ category: "lainnya", message: "x".repeat(501) }, { from: ip(12) });
check("F3 pesan 501 karakter -> 400 (pesan field)", long.status === 400 && !!long.json?.fields?.message, `HTTP ${long.status}`);
const exact = await send({ category: "lainnya", message: `[uji ${tag}]`.padEnd(500, "y") }, { from: ip(12) });
check("F4 pesan tepat 500 karakter -> 201", exact.status === 201, `HTTP ${exact.status}`);
const empty = await send({ category: "lainnya", message: "   " }, { from: ip(12) });
check("F5 pesan kosong/spasi -> 400", empty.status === 400, `HTTP ${empty.status}`);
const badCat = await send({ category: "promosi", message: msg("kategori asing") }, { from: ip(12) });
check("F6 kategori asing -> 400", badCat.status === 400 && !!badCat.json?.fields?.category, `HTTP ${badCat.status}`);

// 4. Draf dikirim ulang (client_ref sama) -> tidak dobel.
const ref = `fb-${tag}-0001`;
const d1 = await send({ category: "tarif", message: msg("draf"), client_ref: ref }, { from: ip(13) });
const d2 = await send({ category: "tarif", message: msg("draf"), client_ref: ref }, { from: ip(13) });
const count = db.prepare("SELECT COUNT(*) c FROM feedback WHERE client_ref = ?").get(ref).c;
check("F7 kirim ulang draf (client_ref sama) -> 200, id sama, 1 baris", d1.status === 201 && d2.status === 200 && d2.json.id === d1.json.id && count === 1, `${d1.status}/${d2.status}, ${count} baris`);

// 5. Rate limit: 5 per 10 menit per IP (tamu) / per akun (login).
const statuses = [];
for (let i = 0; i < 6; i++) statuses.push((await send({ category: "lainnya", message: msg(`rl ${i}`) }, { from: ip(20) })).status);
check("F8 tamu: 5x 201 lalu ke-6 -> 429", statuses.slice(0, 5).every((s) => s === 201) && statuses[5] === 429, statuses.join(","));
const sameIpLoggedIn = await send({ category: "lainnya", message: msg("login di IP yang sama") }, { token: reg.token, from: ip(20) });
check("F9 pengguna login dari IP yang sama tidak ikut terkunci (kunci per akun)", sameIpLoggedIn.status === 201, `HTTP ${sameIpLoggedIn.status}`);

// 6. Token tidak berlaku -> diperlakukan sebagai tamu.
const bad = await send({ category: "lainnya", message: msg("token palsu") }, { token: "token-palsu", from: ip(21) });
check("F10 token tidak berlaku -> 201 sebagai tamu (tidak ditolak)", bad.status === 201 && bad.json.linked_to_account === false && row(bad.json.id)?.user_id === null);

// 7. Lewat tunnel tanpa token.
if (TUNNEL) {
  const t = await send({ category: "saran_fitur", message: msg("lewat tunnel") }, { base: TUNNEL });
  check("F11 lewat tunnel tanpa token -> 201", t.status === 201, `HTTP ${t.status}`);
}
db.close();

console.log(failures === 0 ? "\nSemua uji masukan lulus." : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;

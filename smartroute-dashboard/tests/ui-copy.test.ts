// Aturan teks: tidak ada klaim langsung/terukur, dan Simpul tidak disebut di UI
// selama belum ada izin pemiliknya.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const uiFiles = [...files(join(root, "src/components/moda")), join(root, "src/pages/Moda.tsx")];
const allSource = [...uiFiles, ...files(join(root, "src/greenops")), ...files(join(root, "src/simulation"))];

test("tidak ada kata terukur di UI maupun modul", () => {
  for (const f of allSource) assert.doesNotMatch(readFileSync(f, "utf8"), /terukur/i, f);
});

test("real-time hanya muncul dalam kalimat penyangkalan", () => {
  for (const f of uiFiles) {
    const text = readFileSync(f, "utf8").replace(/bukan data armada real-time/g, "");
    assert.doesNotMatch(text, /real-?time|langsung dari armada|data langsung/i, f);
  }
});

test("Simpul tidak disebut di UI, modul, maupun data", () => {
  for (const f of allSource) assert.doesNotMatch(readFileSync(f, "utf8"), /\bsimpul\b/i, f);
  assert.doesNotMatch(readFileSync(join(root, "public/data/network.json"), "utf8"), /adenaufal|simpul\.[a-z]/i);
});

test("tidak ada klaim kemitraan", () => {
  for (const f of uiFiles) assert.doesNotMatch(readFileSync(f, "utf8"), /mitra (resmi|kami)|bekerja sama dengan|didukung oleh/i, f);
});

// ---------- Penyembunyian sebelum disetujui ----------

test("/moda tidak ditautkan dari mana pun; hanya didaftarkan sebagai rute", () => {
  const hits = files(join(root, "src"))
    .filter((f) => /\.(ts|tsx|css)$/.test(f))
    .filter((f) => /["'`]\/moda["'`]/.test(readFileSync(f, "utf8")))
    .map((f) => f.replace(root, "").replaceAll("\\", "/"));
  assert.deepEqual(hits, ["src/App.tsx"]);
  const app = readFileSync(join(root, "src/App.tsx"), "utf8");
  assert.equal(app.match(/["'`]\/moda["'`]/g)?.length, 1, "satu deklarasi rute, tanpa tautan");
  assert.doesNotMatch(readFileSync(join(root, "index.html"), "utf8"), /moda/i);
});

test("/moda mati secara bawaan: hanya terdaftar bila flag bernilai persis true", () => {
  const app = readFileSync(join(root, "src/App.tsx"), "utf8");
  assert.match(app, /import\.meta\.env\.VITE_MODA_ENABLED === 'true' \? lazy\(\(\) => import\('\.\/pages\/Moda'\)\) : null/);
  assert.doesNotMatch(app, /^import\s[^;]*pages\/Moda/m, "tidak boleh impor statis");
});

test("label aturan malam BRT tidak mengklaim sudah dikonfirmasi", () => {
  const rule = JSON.parse(readFileSync(join(root, "data-src/brt_malam.json"), "utf8"));
  const net = JSON.parse(readFileSync(join(root, "public/data/network.json"), "utf8"));
  assert.equal(rule.status, "asumsi, menunggu konfirmasi TransJakarta");
  assert.equal(net.version.brtNight.label, rule.status, "data harus dibangun dari aturan yang sama");
  assert.match(readFileSync(join(root, "src/components/moda/AboutDialog.tsx"), "utf8"), /\{brtNight\.label\}/);
});

test("GreenOps mati secara bawaan: hanya menyala bila flag bernilai persis true", () => {
  for (const f of ["src/pages/Moda.tsx", "src/components/moda/DetailCard.tsx", "src/components/moda/AboutDialog.tsx"]) {
    assert.match(readFileSync(join(root, f), "utf8"), /import\.meta\.env\.VITE_GREENOPS_ENABLED === "true"/, f);
  }
});

test("panel GreenOps tidak diimpor statis oleh halaman", () => {
  const staticImport = /^import\s[^;]*(GreenOpsPanel|VehicleGreenOps|FactorInfoDialog|greenops\/)/m;
  for (const f of ["src/pages/Moda.tsx", "src/components/moda/DetailCard.tsx", "src/components/moda/AboutDialog.tsx", "src/App.tsx"]) {
    assert.doesNotMatch(readFileSync(join(root, f), "utf8"), staticImport, f);
  }
});

test("tidak ada berkas env di dashboard yang menyalakan flag", () => {
  for (const name of readdirSync(root).filter((n) => n.startsWith(".env"))) {
    assert.doesNotMatch(readFileSync(join(root, name), "utf8"), /VITE_GREENOPS_ENABLED\s*=\s*true/, name);
  }
});

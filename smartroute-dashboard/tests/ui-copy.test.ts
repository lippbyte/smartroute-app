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
  for (const f of allSource) assert.doesNotMatch(readFileSync(f, "utf8"), /simpul/i, f);
  assert.doesNotMatch(readFileSync(join(root, "public/data/network.json"), "utf8"), /adenaufal|simpul\.[a-z]/i);
});

test("tidak ada klaim kemitraan", () => {
  for (const f of uiFiles) assert.doesNotMatch(readFileSync(f, "utf8"), /mitra (resmi|kami)|bekerja sama dengan|didukung oleh/i, f);
});

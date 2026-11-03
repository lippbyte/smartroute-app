// /moda hanya ada bila VITE_MODA_ENABLED=true. Merender rute sungguhan lewat SSR
// Vite pada kedua keadaan flag, dan membangun bundel untuk keadaan bawaan.
//
// Aplikasi ini SPA: server tetap mengirim index.html dengan HTTP 200, jadi "404"
// di sini berarti halaman "Halaman tidak ada." dari rute cadangan. Uji Chrome di
// scripts/test_moda_browser.mjs memeriksa hal yang sama di peramban.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { build, createServer, type ViteDevServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const NOT_FOUND = "Halaman tidak ada.";

// AuthContext membaca localStorage saat inisialisasi; di Node belum ada.
(globalThis as unknown as { localStorage: Pick<Storage, "getItem"> }).localStorage = { getItem: () => null };

const servers: ViteDevServer[] = [];
after(async () => {
  await Promise.all(servers.map((s) => s.close()));
});

function setFlag(value: string | undefined) {
  if (value === undefined) delete process.env.VITE_MODA_ENABLED;
  else process.env.VITE_MODA_ENABLED = value;
}

async function renderAt(flag: string | undefined, paths: string[]): Promise<Record<string, string>> {
  setFlag(flag);
  const server = await createServer({
    root,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  servers.push(server);
  const { AppRoutes } = (await server.ssrLoadModule("/src/App.tsx")) as { AppRoutes: () => React.ReactElement };
  const { AuthProvider } = (await server.ssrLoadModule("/src/context/AuthContext.tsx")) as {
    AuthProvider: React.FC<{ children: React.ReactNode }>;
  };
  const out: Record<string, string> = {};
  for (const location of paths) {
    out[location] = renderToString(
      createElement(StaticRouter, { location }, createElement(AuthProvider, null, createElement(AppRoutes))),
    );
  }
  return out;
}

test("flag mati: /moda jatuh ke halaman tidak ada", async () => {
  const pages = await renderAt(undefined, ["/moda", "/moda/", "/MODA", "/login", "/tidak-ada"]);
  for (const p of ["/moda", "/moda/", "/MODA", "/tidak-ada"]) {
    assert.ok(pages[p].includes(NOT_FOUND), `${p}: harus halaman tidak ada`);
    assert.doesNotMatch(pages[p], /Pemantauan Moda|Memuat/, p);
  }
  assert.ok(!pages["/login"].includes(NOT_FOUND), "rute lain tidak ikut hilang");
  assert.match(pages["/login"], /Login Admin/);
});

test("flag bernilai selain persis true tetap mati", async () => {
  for (const value of ["false", "1", "TRUE", ""]) {
    const pages = await renderAt(value, ["/moda"]);
    assert.ok(pages["/moda"].includes(NOT_FOUND), `VITE_MODA_ENABLED=${JSON.stringify(value)}`);
  }
});

test("flag menyala: /moda terdaftar, bukan halaman tidak ada", async () => {
  const pages = await renderAt("true", ["/moda", "/tidak-ada"]);
  assert.ok(!pages["/moda"].includes(NOT_FOUND), "/moda harus terdaftar");
  assert.ok(pages["/tidak-ada"].includes(NOT_FOUND), "rute cadangan tetap jalan");
});

test("build bawaan: kode /moda dan GreenOps tidak ikut terkirim", async () => {
  setFlag(undefined);
  delete process.env.VITE_GREENOPS_ENABLED;
  const outDir = mkdtempSync(join(tmpdir(), "moda-build-"));
  try {
    await build({ root, logLevel: "silent", build: { outDir, emptyOutDir: true } });
    const assets = join(outDir, "assets");
    const js = readdirSync(assets)
      .filter((f) => f.endsWith(".js"))
      .map((f) => readFileSync(join(assets, f), "utf8"))
      .join("\n");
    assert.ok(js.includes(NOT_FOUND), "pembuktian bahwa pencarian bekerja");
    for (const banned of ["Pemantauan Moda", "Posisi berdasarkan jadwal", "GreenOps", "theicct.org", "moda-vehicles"]) {
      assert.ok(!js.includes(banned), `bundel tidak boleh memuat ${banned}`);
    }
    assert.ok(!readdirSync(assets).some((f) => /^(Moda|GreenOps)/.test(f)), "tidak ada chunk Moda atau GreenOps");
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

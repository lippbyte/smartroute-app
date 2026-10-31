// Hari 4 Task 1: pastikan tidak ada teks "TODO" / placeholder yang bisa
// TAMPIL di UI.
//
//   node scripts/scan-ui-text.mjs            (dari smartroute/)
//
// Memakai parser TypeScript (bukan grep) supaya hanya string yang bisa
// dirender yang diperiksa: teks JSX, literal string, dan template literal di
// src/**/*.ts(x). Komentar (mis. penanda "TODO:isi" / "TODO:verifikasi" untuk
// tim) TIDAK ikut, begitu pula argumen console.*, path import, dan tipe
// literal. Uji-diri dengan fixture lebih dulu supaya pemindai tidak lulus
// kosong.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = path.join(import.meta.dirname, "..", "src");

const PATTERNS = [
  /\bTODO\b/i,
  /\bTBD\b/,
  /\bFIXME\b/i,
  /\bXXX\b/,
  /lorem|ipsum/i,
  /\bplaceholder\b/i,
  /segera tersedia/i,
  /coming soon/i,
  /\bdummy\b/i,
  /\basdf\b/i,
  /^(undefined|null|NaN)$/,
  /\[(isi|nama|kontak|email|nomor)[^\]]*\]/i, // "[isi kontak]"
];

function isConsoleArg(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const e = p.expression;
      return ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "console";
    }
    if (ts.isBlock(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

function isNonRenderable(node) {
  const p = node.parent;
  if (!p) return true;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isLiteralTypeNode(p)) return true;
  if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === "require") return true;
  // Nama kelas Tailwind (mis. "placeholder:text-muted") bukan teks.
  if (ts.isJsxAttribute(p) && /className$/.test(p.name.getText())) return true;
  return isConsoleArg(node);
}

/** Semua string yang bisa dirender di satu berkas: [{ line, text }]. */
export function renderableStrings(fileName, source) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = [];
  const add = (node, text) => {
    const t = text.trim();
    if (t) out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: t });
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) add(node, node.text);
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isNonRenderable(node)) add(node, node.text);
    else if (ts.isTemplateExpression(node) && !isNonRenderable(node)) {
      add(node, [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(" "));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export function findPlaceholders(fileName, source) {
  return renderableStrings(fileName, source).filter((s) => PATTERNS.some((re) => re.test(s.text)));
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts") ? [p] : [];
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  let failures = 0;
  const check = (name, ok, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
  };

  // --- Uji-diri: yang harus tertangkap & yang harus diabaikan.
  const fixture = `
    // TODO:isi kontak — komentar, diabaikan
    import x from "./TODO-modul";
    type T = "TODO";
    export const A = "Kontak: segera tersedia";
    export function F() {
      console.warn("TODO di console, diabaikan");
      return (<View className="placeholder:text-muted">
        <Text>TODO: isi nama tim</Text>
        <Text>{\`Halo \${n}, [isi email]\`}</Text>
        <TextInput placeholder="Cari halte..." />
        <Text>Teks biasa</Text>
      </View>);
    }`;
  const hits = findPlaceholders("fixture.tsx", fixture).map((h) => h.text);
  check(
    "U1 uji-diri: teks JSX 'TODO', konstanta 'segera tersedia', template '[isi email]' tertangkap",
    hits.length === 3 && hits.some((h) => h.startsWith("TODO: isi")) && hits.includes("Kontak: segera tersedia") && hits.some((h) => h.includes("[isi email]")),
    JSON.stringify(hits),
  );
  check("U2 uji-diri: komentar, import, tipe, console, className, placeholder input diabaikan", !hits.some((h) => /komentar|modul|console|text-muted|Cari halte/.test(h)) && !hits.includes("TODO"));

  // --- Pindai src/.
  const files = walk(ROOT);
  let total = 0;
  const found = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    total += renderableStrings(f, src).length;
    for (const h of findPlaceholders(f, src)) found.push(`${path.relative(path.join(ROOT, ".."), f)}:${h.line}  ${JSON.stringify(h.text.slice(0, 90))}`);
  }
  check(`P1 pemindaian mencakup seluruh src (${files.length} berkas, ${total} string)`, files.length >= 100 && total >= 1000);
  check("P2 tidak ada teks TODO/placeholder yang bisa tampil di UI", found.length === 0, found.length ? `\n    ${found.join("\n    ")}` : "0 temuan");

  console.log(failures === 0 ? "\nPemindaian teks UI bersih." : `\n${failures} pemeriksaan GAGAL.`);
  process.exitCode = failures ? 1 : 0;
}

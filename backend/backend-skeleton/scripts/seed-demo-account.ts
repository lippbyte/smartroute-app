// Hari 1 Task 2: buat akun demo untuk presentasi.
//
//   npm run seed:demo                  — buat akun bila belum ada
//   npm run seed:demo -- --reset       — ganti password akun yang sudah ada
//
// Kredensial ditulis HANYA ke data/demo-account.local.json (di-gitignore),
// tidak dicetak ke terminal — jangan salin ke chat/laporan/commit.
// Domain .test dicadangkan (RFC 2606), jadi tidak mungkin milik orang lain.
import "dotenv/config";
import { randomInt } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { hashPassword } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { createUser, findUserForLogin } from "../src/services/users";

const EMAIL = "demo@smartroute.test";
const NAME = "Demo SmartRoute";
const OUT = path.join(__dirname, "..", "data", "demo-account.local.json");

// Mudah diketik di HP saat demo: 3 kelompok huruf kecil+angka tanpa
// karakter yang mirip (0/o, 1/l/i).
function readablePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

async function main() {
  const reset = process.argv.includes("--reset");
  const existing = findUserForLogin(EMAIL);

  if (existing && !reset) {
    console.log(
      existsSync(OUT)
        ? `Akun demo sudah ada. Kredensial: ${OUT}`
        : `Akun demo sudah ada tetapi file kredensial hilang. Jalankan: npm run seed:demo -- --reset`,
    );
    return;
  }

  const password = readablePassword();
  const passwordHash = await hashPassword(password);
  if (existing) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, existing.id);
    // Sesi lama dicabut: siapa pun yang masuk dengan password lama keluar.
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
  } else {
    createUser({ email: EMAIL, name: NAME, passwordHash });
  }

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ email: EMAIL, password, catatan: "Lokal saja — jangan di-commit atau dibagikan di chat." }, null, 2),
  );
  console.log(`${existing ? "Password akun demo diganti" : "Akun demo dibuat"}. Kredensial: ${OUT}`);
}

main();

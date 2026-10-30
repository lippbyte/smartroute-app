// Hari 1 Task 1: penyimpanan akun, sesi, riwayat perjalanan, dan rating.
//
// SQLite bawaan Node (`node:sqlite`, Node >= 22.5) — keputusan Task 0f:
// tanpa dependency baru, tahan restart backend (berbeda dari laporan
// kepadatan yang sengaja hanya di memori, lihat services/crowdDensity.ts).
// Di Node 24 modul ini masih berlabel eksperimental: muncul satu
// ExperimentalWarning saat start, bukan galat.
//
// File database di data/ (di-.gitignore) — berisi hash password dan data
// pribadi, tidak boleh ikut ter-commit.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DB_PATH = path.join(__dirname, "..", "..", "data", "smartroute.db");

// Diekspor: file konfigurasi pendamping (mis. data/toto-limits.json) ditaruh
// di folder yang sama dengan database.
export const dbPath = process.env.DB_PATH || DEFAULT_DB_PATH;

function openDatabase(): DatabaseSync {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      preferences_json TEXT NOT NULL DEFAULT '{}',
      -- Data pribadi sensitif: disimpan terpisah dari preferences_json supaya
      -- bisa dihapus tuntas (DELETE /me/accessibility) dan tidak pernah
      -- ikut terkirim ke provider LLM bersama preferensi biasa.
      accessibility_json TEXT,
      accessibility_consent_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      -- SHA-256 dari token, bukan token-nya: kebocoran file DB tidak
      -- memberi sesi yang bisa langsung dipakai.
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      -- Pengenal dari app supaya kirim ulang (jaringan putus lalu coba lagi)
      -- tidak membuat entri riwayat ganda.
      client_ref TEXT,
      created_at TEXT NOT NULL,
      origin_label TEXT NOT NULL,
      destination_label TEXT NOT NULL,
      route_summary_json TEXT NOT NULL,
      predicted_min INTEGER,
      predicted_max INTEGER,
      actual_duration_min INTEGER,
      duration_basis TEXT NOT NULL CHECK (duration_basis IN ('aktual', 'estimasi')),
      fare_total INTEGER NOT NULL,
      co2_estimate_g INTEGER,
      UNIQUE (user_id, client_ref)
    );
    CREATE INDEX IF NOT EXISTS trips_user_created ON trips(user_id, created_at);

    CREATE TABLE IF NOT EXISTS ratings (
      -- PRIMARY KEY = satu rating per perjalanan (ubah rating di luar cakupan).
      trip_id TEXT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
      stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
      eta_accurate INTEGER,
      transfer_risk_accurate INTEGER,
      crowd_accurate INTEGER,
      message TEXT,
      created_at TEXT NOT NULL
    );

    -- Hari 1 Task 4: satu baris per percobaan memanggil TOTO (LLM), dasar
    -- batas per jam per pengguna dan batas global harian. Di DB, bukan
    -- memori, supaya restart backend tidak mengosongkan hitungan.
    CREATE TABLE IF NOT EXISTS toto_usage (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      asked_at INTEGER NOT NULL -- epoch ms
    );
    CREATE INDEX IF NOT EXISTS toto_usage_user_time ON toto_usage(user_id, asked_at);
    CREATE INDEX IF NOT EXISTS toto_usage_time ON toto_usage(asked_at);

    -- Hari 2 Task 2: pagar pemakaian IQAir (satu baris per panggilan keluar)
    -- dan nilai terakhir yang sukses (cadangan bila API gagal). Di DB supaya
    -- restart backend tidak mengosongkan hitungan maupun cadangan.
    CREATE TABLE IF NOT EXISTS iqair_calls (called_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS iqair_calls_time ON iqair_calls(called_at);
    -- Hari 3 Task 4: masukan dari layar "Tentang & Masukan". user_id NULL =
    -- tamu. IP TIDAK disimpan (hanya dipakai di memori untuk rate limit).
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      client_ref TEXT UNIQUE,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      app_version TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS air_quality_last (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload_json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );
  `);
  return db;
}

export const db = openDatabase();

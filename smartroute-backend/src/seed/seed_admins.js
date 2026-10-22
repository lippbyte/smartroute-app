// src/db/seed_admins.js
// Seed data KHUSUS untuk tabel: admins
// Dipisah dari seed.js karena berisi kredensial login.
// Password di-hash pakai bcrypt sebelum disimpan.
//
// Install dulu jika belum ada: npm install bcrypt
// Jalankan: node src/db/seed_admins.js

const bcrypt = require("bcrypt");
const pool = require("../db/pool");

const SALT_ROUNDS = 10;

// Ganti password default ini sebelum dipakai di production.
const admins = [
  {
    email: "admin@smartroute.id",
    password: "Admin@123",
    name: "Super Admin",
  },
  {
    email: "operator1@smartroute.id",
    password: "Operator@123",
    name: "Operator Satu",
  },
  {
    email: "operator2@smartroute.id",
    password: "Operator@123",
    name: "Operator Dua",
  },
];

async function seedAdmins(client) {
  for (const a of admins) {
    const passwordHash = await bcrypt.hash(a.password, SALT_ROUNDS);
    await client.query(
      `INSERT INTO admins (email, password, name, last_login)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (email) DO NOTHING`,
      [a.email, passwordHash, a.name]
    );
  }
  console.log(`Seeded ${admins.length} rows into admins`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await seedAdmins(client);
    await client.query("COMMIT");
    console.log("✅ Seeding admins selesai.");
    console.log("⚠️  Ingat: ganti password default sebelum production.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seeding admins gagal, rollback:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
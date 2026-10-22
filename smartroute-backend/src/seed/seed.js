// src/db/seed.js
// Seed data untuk tabel: stations, station_flags, fleet_units
// Jalankan: node src/db/seed.js
//
// Catatan akurasi data dummy:
// - density_score dihitung dari rasio passenger_count terhadap kapasitas
//   realistis stasiun/halte per jenis transportasi (MRT/LRT/BRT), lalu
//   dibulatkan 2 desimal (kolom numeric(3,2), rentang 0.00 - 9.99).
// - density_level diturunkan otomatis dari density_score dengan ambang:
//     LOW      : skor < 3.50
//     MEDIUM   : 3.50 - 5.99
//     HIGH     : 6.00 - 8.49
//     CRITICAL : skor >= 8.50
// - flag_type hanya berisi dua nilai: OPTIMAL atau PROBLEMATIC, konsisten
//   dengan status operasional stasiun (mis. MAINTENANCE / anomaly -> PROBLEMATIC).
const pool = require("./pool");

// Kapasitas tampung wajar per platform/halte, dipakai untuk menghitung skor kepadatan.
const CAPACITY_BY_TYPE = {
  MRT: 700, // platform bawah tanah/layang, area tunggu MRT Jakarta
  LRT: 350, // platform LRT Jakarta, lebih kecil dari MRT
  BRT: 120, // halte Transjakarta standar koridor
};

// Ambang batas density_level berdasarkan density_score (skala 0.00 - 9.99)
function densityLevelFromScore(score) {
  if (score >= 8.5) return "CRITICAL";
  if (score >= 6.0) return "HIGH";
  if (score >= 3.5) return "MEDIUM";
  return "LOW";
}

// density_score = (passenger_count / capacity) * 10, dibulatkan 2 desimal, dibatasi max 9.99
function computeDensityScore(passengerCount, transportType) {
  const capacity = CAPACITY_BY_TYPE[transportType];
  const raw = (passengerCount / capacity) * 10;
  const clamped = Math.min(raw, 9.99);
  return Math.round(clamped * 100) / 100;
}

// -----------------------------
// STATIONS
// passenger_count disusun realistis relatif terhadap kapasitas masing-masing
// jenis transportasi, lalu density_score & density_level dihitung otomatis
// agar ketiganya selalu konsisten satu sama lain.
// -----------------------------
const stationsRaw = [
  {
    id: "STN-001",
    name: "Stasiun Dukuh Atas",
    coordinates: "(-6.2018,106.8229)",
    route_or_line: "MRT Lebak Bulus - Bundaran HI",
    passenger_count: 490, // 490/700 -> padat, jam sibuk
    avg_dwell_time_sec: 95,
    next_arrival_eta_sec: 120,
    status: "ACTIVE",
    transport_type: "MRT",
    station_code: "DKA",
  },
  {
    id: "STN-002",
    name: "Stasiun Bundaran HI",
    coordinates: "(-6.1954,106.8231)",
    route_or_line: "MRT Lebak Bulus - Bundaran HI",
    passenger_count: 665, // 665/700 -> mendekati kapasitas maksimal
    avg_dwell_time_sec: 110,
    next_arrival_eta_sec: 60,
    status: "ACTIVE",
    transport_type: "MRT",
    station_code: "BHI",
  },
  {
    id: "STN-003",
    name: "Stasiun Lebak Bulus",
    coordinates: "(-6.2897,106.7746)",
    route_or_line: "MRT Lebak Bulus - Bundaran HI",
    passenger_count: 245, // 245/700 -> lengang, stasiun ujung jalur
    avg_dwell_time_sec: 80,
    next_arrival_eta_sec: 240,
    status: "ACTIVE",
    transport_type: "MRT",
    station_code: "LBB",
  },
  {
    id: "STN-004",
    name: "Halte Transjakarta Harmoni",
    coordinates: "(-6.1657,106.8188)",
    route_or_line: "Koridor 1",
    passenger_count: 92, // 92/120 -> halte transit utama, cukup padat
    avg_dwell_time_sec: 70,
    next_arrival_eta_sec: 90,
    status: "ACTIVE",
    transport_type: "BRT",
    station_code: "HRM",
  },
  {
    id: "STN-005",
    name: "Halte Transjakarta Blok M",
    coordinates: "(-6.2440,106.7994)",
    route_or_line: "Koridor 1",
    passenger_count: 50, // 50/120 -> jam biasa, tidak padat
    avg_dwell_time_sec: 65,
    next_arrival_eta_sec: 180,
    status: "ACTIVE",
    transport_type: "BRT",
    station_code: "BLM",
  },
  {
    id: "STN-006",
    name: "Stasiun LRT Velodrome",
    coordinates: "(-6.2266,106.8985)",
    route_or_line: "LRT Jakarta",
    passenger_count: 35, // 35/350 -> sangat lengang, sedang maintenance
    avg_dwell_time_sec: 60,
    next_arrival_eta_sec: 300,
    status: "MAINTENANCE",
    transport_type: "LRT",
    station_code: "VLD",
  },
  {
    id: "STN-007",
    name: "Stasiun LRT Pegangsaan Dua",
    coordinates: "(-6.1439,106.9083)",
    route_or_line: "LRT Jakarta",
    passenger_count: 60, // 60/350 -> lengang, stasiun depo/ujung jalur
    avg_dwell_time_sec: 55,
    next_arrival_eta_sec: 360,
    status: "ACTIVE",
    transport_type: "LRT",
    station_code: "PGD",
  },
  {
    id: "STN-008",
    name: "Halte Transjakarta Kota",
    coordinates: "(-6.1352,106.8133)",
    route_or_line: "Koridor 1",
    passenger_count: 118, // 118/120 -> hampir mencapai kapasitas maksimal
    avg_dwell_time_sec: 88,
    next_arrival_eta_sec: 45,
    status: "ACTIVE",
    transport_type: "BRT",
    station_code: "KTA",
  },
];

// Lengkapi setiap stasiun dengan density_score, density_level, dan
// ai_anomaly_flag (true hanya jika status bukan ACTIVE atau level CRITICAL)
// supaya seluruh kolom saling konsisten.
const stations = stationsRaw.map((s) => {
  const density_score = computeDensityScore(s.passenger_count, s.transport_type);
  const density_level = densityLevelFromScore(density_score);
  const ai_anomaly_flag = density_level === "CRITICAL" || s.status !== "ACTIVE";
  return { ...s, density_score, density_level, ai_anomaly_flag };
});

// -----------------------------
// STATION_FLAGS
// flag_type hanya OPTIMAL atau PROBLEMATIC.
// PROBLEMATIC dipasang untuk stasiun dengan density_level CRITICAL/HIGH
// atau status bukan ACTIVE; sisanya OPTIMAL, sesuai data stations di atas.
// (station_id merujuk ke stations.id)
// -----------------------------
const stationFlags = [
  {
    station_id: "STN-001",
    flag_type: "PROBLEMATIC",
    severity_level: 3,
    notes: "Kepadatan penumpang tinggi pada jam sibuk pagi, mendekati kapasitas platform.",
    flagged_by: "AI_SYSTEM",
    active_flag: true,
  },
  {
    station_id: "STN-002",
    flag_type: "PROBLEMATIC",
    severity_level: 4,
    notes: "Kepadatan penumpang kritis, mendekati kapasitas maksimal platform.",
    flagged_by: "AI_SYSTEM",
    active_flag: true,
  },
  {
    station_id: "STN-003",
    flag_type: "OPTIMAL",
    severity_level: 1,
    notes: "Arus penumpang lancar, jauh di bawah kapasitas platform.",
    flagged_by: "AI_SYSTEM",
    active_flag: true,
  },
  {
    station_id: "STN-004",
    flag_type: "PROBLEMATIC",
    severity_level: 3,
    notes: "Halte transit utama hampir mencapai kapasitas tampung maksimal.",
    flagged_by: "AI_SYSTEM",
    active_flag: true,
  },
  {
    station_id: "STN-005",
    flag_type: "OPTIMAL",
    severity_level: 1,
    notes: "Kondisi halte normal, kepadatan rendah.",
    flagged_by: "AI_SYSTEM",
    active_flag: true,
  },
  {
    station_id: "STN-006",
    flag_type: "PROBLEMATIC",
    severity_level: 2,
    notes: "Stasiun dalam masa perbaikan eskalator, layanan terbatas.",
    flagged_by: "admin@smartroute.id",
    active_flag: true,
  },
  {
    station_id: "STN-007",
    flag_type: "OPTIMAL",
    severity_level: 1,
    notes: "Operasional normal, kepadatan rendah.",
    flagged_by: "AI_SYSTEM",
    active_flag: true,
  },
  {
    station_id: "STN-008",
    flag_type: "PROBLEMATIC",
    severity_level: 4,
    notes: "Kepadatan penumpang mendekati kapasitas maksimal halte pada jam pulang kerja.",
    flagged_by: "AI_SYSTEM",
    active_flag: true,
  },
];

// -----------------------------
// FLEET_UNITS
// current_load disesuaikan agar realistis terhadap passenger_capacity
// masing-masing unit (tidak pernah melebihi kapasitas).
// -----------------------------
const fleetUnits = [
  {
    unit_id: "UNIT-001",
    unit_name: "MRT Trainset 01",
    transport_type: "MRT",
    assigned_corridor: "Lebak Bulus - Bundaran HI",
    current_status: "IN_SERVICE",
    current_speed_kmh: 62.5,
    passenger_capacity: 900,
    current_load: 665, // selaras dengan STN-002 (Bundaran HI) tempat unit ini berada
    last_lat: -6.1954,
    last_lng: 106.8231,
  },
  {
    unit_id: "UNIT-002",
    unit_name: "MRT Trainset 02",
    transport_type: "MRT",
    assigned_corridor: "Lebak Bulus - Bundaran HI",
    current_status: "IN_SERVICE",
    current_speed_kmh: 55.2,
    passenger_capacity: 900,
    current_load: 490, // selaras dengan STN-001 (Dukuh Atas)
    last_lat: -6.2018,
    last_lng: 106.8229,
  },
  {
    unit_id: "UNIT-003",
    unit_name: "Bus Transjakarta B-001",
    transport_type: "BRT",
    assigned_corridor: "Koridor 1",
    current_status: "IN_SERVICE",
    current_speed_kmh: 28.7,
    passenger_capacity: 85,
    current_load: 76,
    last_lat: -6.1657,
    last_lng: 106.8188,
  },
  {
    unit_id: "UNIT-004",
    unit_name: "Bus Transjakarta B-002",
    transport_type: "BRT",
    assigned_corridor: "Koridor 1",
    current_status: "DELAYED",
    current_speed_kmh: 8.4,
    passenger_capacity: 85,
    current_load: 82,
    last_lat: -6.1352,
    last_lng: 106.8133,
  },
  {
    unit_id: "UNIT-005",
    unit_name: "LRT Trainset 01",
    transport_type: "LRT",
    assigned_corridor: "LRT Jakarta",
    current_status: "IN_SERVICE",
    current_speed_kmh: 45.0,
    passenger_capacity: 270,
    current_load: 60,
    last_lat: -6.2266,
    last_lng: 106.8985,
  },
  {
    unit_id: "UNIT-006",
    unit_name: "LRT Trainset 02",
    transport_type: "LRT",
    assigned_corridor: "LRT Jakarta",
    current_status: "OUT_OF_SERVICE",
    current_speed_kmh: 0,
    passenger_capacity: 270,
    current_load: 0,
    last_lat: -6.1439,
    last_lng: 106.9083,
  },
  {
    unit_id: "UNIT-007",
    unit_name: "Bus Transjakarta B-003",
    transport_type: "BRT",
    assigned_corridor: "Koridor 1",
    current_status: "IN_SERVICE",
    current_speed_kmh: 32.1,
    passenger_capacity: 85,
    current_load: 40,
    last_lat: -6.2440,
    last_lng: 106.7994,
  },
];

async function seedStations(client) {
  for (const s of stations) {
    await client.query(
      `INSERT INTO stations
        (id, name, coordinates, route_or_line, passenger_count, density_level,
         density_score, avg_dwell_time_sec, next_arrival_eta_sec, status,
         ai_anomaly_flag, updated_at, transport_type, station_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12,$13)
       ON CONFLICT (id) DO NOTHING`,
      [
        s.id,
        s.name,
        s.coordinates,
        s.route_or_line,
        s.passenger_count,
        s.density_level,
        s.density_score,
        s.avg_dwell_time_sec,
        s.next_arrival_eta_sec,
        s.status,
        s.ai_anomaly_flag,
        s.transport_type,
        s.station_code,
      ]
    );
  }
  console.log(`Seeded ${stations.length} rows into stations`);
}

async function seedStationFlags(client) {
  for (const f of stationFlags) {
    await client.query(
      `INSERT INTO station_flags
        (station_id, flag_type, severity_level, notes, flagged_by, created_at, active_flag)
       VALUES ($1,$2,$3,$4,$5,NOW(),$6)`,
      [
        f.station_id,
        f.flag_type,
        f.severity_level,
        f.notes,
        f.flagged_by,
        f.active_flag,
      ]
    );
  }
  console.log(`Seeded ${stationFlags.length} rows into station_flags`);
}

async function seedFleetUnits(client) {
  for (const u of fleetUnits) {
    await client.query(
      `INSERT INTO fleet_units
        (unit_id, unit_name, transport_type, assigned_corridor, current_status,
         current_speed_kmh, passenger_capacity, current_load, last_lat, last_lng, last_updated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (unit_id) DO NOTHING`,
      [
        u.unit_id,
        u.unit_name,
        u.transport_type,
        u.assigned_corridor,
        u.current_status,
        u.current_speed_kmh,
        u.passenger_capacity,
        u.current_load,
        u.last_lat,
        u.last_lng,
      ]
    );
  }
  console.log(`Seeded ${fleetUnits.length} rows into fleet_units`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // urutan: stations dulu (parent), baru station_flags (child via station_id),
    // lalu fleet_units (independen)
    await seedStations(client);
    await seedStationFlags(client);
    await seedFleetUnits(client);
    await client.query("COMMIT");
    console.log("✅ Seeding selesai.");
    stations.forEach((s) =>
      console.log(`  ${s.id} ${s.name}: score=${s.density_score} level=${s.density_level}`)
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seeding gagal, rollback:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
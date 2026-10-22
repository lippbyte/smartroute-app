const db = require('../db/pool');

// Fungsi untuk mengacak angka di dalam rentang min-max
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simulasi perubahan data stasiun
async function simulateStationUpdates() {
  try {
    // Ambil semua ID stasiun
    const stations = await db.query('SELECT id FROM stations');
    
    for (const station of stations.rows) {
      const passengerCount = getRandomInt(10, 500);
      let densityLevel = 'LOW';
      let densityScore = (passengerCount / 500).toFixed(2); // Nilai 0.00 - 1.00

      if (densityScore >= 0.8) densityLevel = 'CRITICAL';
      else if (densityScore >= 0.5) densityLevel = 'HIGH';
      else if (densityScore >= 0.2) densityLevel = 'MEDIUM';

      const avgDwellTime = getRandomInt(30, 180);
      const etaSec = getRandomInt(60, 600);

      // Update data di database
      await db.query(`
        UPDATE stations SET
          passenger_count = $1,
          density_level = $2,
          density_score = $3,
          avg_dwell_time_sec = $4,
          next_arrival_eta_sec = $5,
          updated_at = NOW()
        WHERE id = $6
      `, [passengerCount, densityLevel, densityScore, avgDwellTime, etaSec, station.id]);
    }

    console.log(`[SIMULATOR] Data stasiun berhasil diperbarui pada ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.error('[SIMULATOR] Gagal mengupdate data stasiun:', error.message);
  }
}

// Jalankan simulasi setiap 10 detik (10000 ms)
function startSimulation() {
  console.log('--- Simulasi Data Real-Time Dimulai ---');
  setInterval(simulateStationUpdates, 10000);
}

module.exports = { startSimulation };
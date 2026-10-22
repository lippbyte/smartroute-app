// src/controllers/stationController.js
const pool = require("../db/pool");

// GET /api/stations
async function getAllStations(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, coordinates, route_or_line, passenger_count,
              density_level, density_score, avg_dwell_time_sec,
              next_arrival_eta_sec, status, ai_anomaly_flag
       FROM stations
       ORDER BY name ASC`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getAllStations error:", err);
    res.status(500).json({ success: false, data: null, message: "Gagal mengambil data stasiun" });
  }
}

// GET /api/stations/:id
async function getStationById(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, coordinates, route_or_line, passenger_count,
              density_level, density_score, avg_dwell_time_sec,
              next_arrival_eta_sec, status, ai_anomaly_flag
       FROM stations
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, message: "Stasiun tidak ditemukan" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("getStationById error:", err);
    res.status(500).json({ success: false, data: null, message: "Gagal mengambil data stasiun" });
  }
}

module.exports = { getAllStations, getStationById };

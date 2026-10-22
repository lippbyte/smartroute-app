// src/controllers/fleetController.js
const pool = require("../db/pool");

// GET /api/fleets
async function getAllFleets(req, res) {
  try {
    const result = await pool.query(
      `SELECT unit_id, unit_name, transport_type, assigned_corridor,
              current_status, current_speed_kmh, passenger_capacity,
              current_load, last_lat, last_lng, last_updated
       FROM fleet_units
       ORDER BY unit_name ASC`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getAllFleets error:", err);
    res.status(500).json({ success: false, data: null, message: "Gagal mengambil data armada" });
  }
}

module.exports = { getAllFleets };

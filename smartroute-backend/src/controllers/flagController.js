// src/controllers/flagController.js
const pool = require("../db/pool");

const VALID_FLAG_TYPES = ["problematic", "optimal"];

// GET /api/flags?flag_type=problematic|optimal
// Hanya flag yang masih aktif (active_flag = true)
async function getActiveFlags(req, res) {
  const { flag_type } = req.query;

  try {
    const params = [];
    let where = "WHERE sf.active_flag = true";

    if (flag_type) {
      if (!VALID_FLAG_TYPES.includes(flag_type)) {
        return res.status(400).json({ success: false, data: null, message: "flag_type tidak valid" });
      }
      params.push(flag_type);
      where += ` AND sf.flag_type = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT sf.*, s.name AS station_name, s.route_or_line, s.density_score
       FROM station_flags sf
       JOIN stations s ON s.id = sf.station_id
       ${where}
       ORDER BY sf.created_at DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getActiveFlags error:", err);
    res.status(500).json({ success: false, data: null, message: "Gagal mengambil data flag" });
  }
}

// GET /api/flags/all?flag_type=problematic|optimal
// Semua flag, termasuk riwayat lama (active_flag = false)
async function getAllFlags(req, res) {
  const { flag_type } = req.query;

  try {
    const params = [];
    let where = "";

    if (flag_type) {
      if (!VALID_FLAG_TYPES.includes(flag_type)) {
        return res.status(400).json({ success: false, data: null, message: "flag_type tidak valid" });
      }
      params.push(flag_type);
      where = `WHERE sf.flag_type = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT sf.*, s.name AS station_name, s.route_or_line, s.density_score
       FROM station_flags sf
       JOIN stations s ON s.id = sf.station_id
       ${where}
       ORDER BY sf.created_at DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getAllFlags error:", err);
    res.status(500).json({ success: false, data: null, message: "Gagal mengambil riwayat flag" });
  }
}

// POST /api/flags
// body: { station_id, flag_type, severity_level?, notes?, flagged_by? }
async function createFlag(req, res) {
  const { station_id, flag_type, severity_level, notes, flagged_by } = req.body;

  if (!station_id || !flag_type) {
    return res.status(400).json({ success: false, data: null, message: "station_id dan flag_type wajib diisi" });
  }
  if (!VALID_FLAG_TYPES.includes(flag_type)) {
    return res.status(400).json({ success: false, data: null, message: "flag_type tidak valid" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const stationCheck = await client.query("SELECT id FROM stations WHERE id = $1", [station_id]);
    if (stationCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, data: null, message: "Stasiun tidak ditemukan" });
    }

    // Nonaktifkan flag aktif sebelumnya dengan tipe yang sama untuk stasiun ini,
    // supaya tidak ada duplikat flag aktif pada stasiun+tipe yang sama.
    await client.query(
      `UPDATE station_flags
       SET active_flag = false
       WHERE station_id = $1 AND flag_type = $2 AND active_flag = true`,
      [station_id, flag_type]
    );

    const insertResult = await client.query(
      `INSERT INTO station_flags (station_id, flag_type, severity_level, notes, flagged_by, active_flag)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [station_id, flag_type, severity_level || null, notes || null, flagged_by || null]
    );

    await client.query("COMMIT");

    // Ambil ulang dengan join supaya bentuk response konsisten dengan endpoint GET
    const joined = await pool.query(
      `SELECT sf.*, s.name AS station_name, s.route_or_line, s.density_score
       FROM station_flags sf
       JOIN stations s ON s.id = sf.station_id
       WHERE sf.id = $1`,
      [insertResult.rows[0].id]
    );

    res.status(201).json({ success: true, data: joined.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createFlag error:", err);
    res.status(500).json({ success: false, data: null, message: "Gagal membuat flag" });
  } finally {
    client.release();
  }
}

// PUT /api/flags/:id/deactivate
async function deactivateFlag(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE station_flags
       SET active_flag = false
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, data: null, message: "Flag tidak ditemukan" });
    }

    const joined = await pool.query(
      `SELECT sf.*, s.name AS station_name, s.route_or_line, s.density_score
       FROM station_flags sf
       JOIN stations s ON s.id = sf.station_id
       WHERE sf.id = $1`,
      [id]
    );

    res.json({ success: true, data: joined.rows[0] });
  } catch (err) {
    console.error("deactivateFlag error:", err);
    res.status(500).json({ success: false, data: null, message: "Gagal menonaktifkan flag" });
  }
}

module.exports = { getActiveFlags, getAllFlags, createFlag, deactivateFlag };

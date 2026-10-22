// src/index.js
const express = require("express");
const cors = require("cors");
const { startSimulation } = require('./seed/simulator');
require("dotenv").config();

const stationRoutes = require("./routes/stationRoutes");
const fleetRoutes = require("./routes/fleetRoutes");
const flagRoutes = require("./routes/flagRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/stations", stationRoutes);
app.use("/api/fleets", fleetRoutes);
app.use("/api/flags", flagRoutes);
app.use("/api/admins", adminRoutes);

// Health check sederhana
app.get("/api/health", (req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, data: null, message: "Endpoint tidak ditemukan" });
});

// Error handler umum
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, data: null, message: "Terjadi kesalahan pada server" });
});

app.listen(PORT, () => {
  console.log(`SmartRoute backend berjalan di http://localhost:${PORT}`);
  startSimulation();
});

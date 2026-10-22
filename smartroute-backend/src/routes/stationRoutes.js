// src/routes/stationRoutes.js
const express = require("express");
const router = express.Router();
const { getAllStations, getStationById } = require("../controllers/stationController");

router.get("/", getAllStations);
router.get("/:id", getStationById);

module.exports = router;

// src/routes/fleetRoutes.js
const express = require("express");
const router = express.Router();
const { getAllFleets } = require("../controllers/fleetController");

router.get("/", getAllFleets);

module.exports = router;

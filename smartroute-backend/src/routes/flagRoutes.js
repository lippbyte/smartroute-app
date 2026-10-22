// src/routes/flagRoutes.js
const express = require("express");
const router = express.Router();
const {
  getActiveFlags,
  getAllFlags,
  createFlag,
  deactivateFlag,
} = require("../controllers/flagController");

// Urutan penting: /all harus didefinisikan sebelum /:id agar tidak tertangkap sebagai param
router.get("/all", getAllFlags);
router.get("/", getActiveFlags);
router.post("/", createFlag);
router.put("/:id/deactivate", deactivateFlag);

module.exports = router;

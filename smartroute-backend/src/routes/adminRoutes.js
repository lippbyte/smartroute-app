const express = require("express");
const router = express.Router();
const {
  getAllAdmins,
  getAdminById,
  loginAdmin,
  createAdmin,
  updateAdmin,
  deleteAdmin,
} = require("../controllers/adminController");

router.post("/login", loginAdmin);
router.get("/", getAllAdmins);
router.get("/:id", getAdminById);
router.post("/", createAdmin);
router.put("/:id", updateAdmin);
router.delete("/:id", deleteAdmin);

module.exports = router;
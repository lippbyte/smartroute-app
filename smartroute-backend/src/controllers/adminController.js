const jwt = require("jsonwebtoken"); // npm install jsonwebtoken
const pool = require("../db/pool");
const bcrypt = require("bcrypt");

// Get all admins
const getAllAdmins = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, name, last_login FROM admins ORDER BY id ASC"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching admins:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get admin by ID
const getAdminById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT id, email, name, last_login FROM admins WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching admin:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email dan password wajib diisi" });
  }

  try {
    const result = await pool.query("SELECT * FROM admins WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    const admin = result.rows[0];
    const match = await bcrypt.compare(password, admin.password);

    if (!match) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    // Update last_login
    await pool.query("UPDATE admins SET last_login = NOW() WHERE id = $1", [admin.id]);

    // Buat JWT Token (Gunakan JWT_SECRET dari .env)
    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name },
      process.env.JWT_SECRET || "secretkey_smartroute",
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login berhasil",
      token,
      user: { id: admin.id, email: admin.email, name: admin.name }
    });
  } catch (err) {
    console.error("Error login:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Create new admin
const createAdmin = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: "Email, password, and name are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO admins (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, last_login",
      [email, hashedPassword, name]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating admin:", err);
    if (err.code === "23505") { // Unique constraint violation (jika email unique)
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update admin
const updateAdmin = async (req, res) => {
  const { id } = req.params;
  const { email, password, name } = req.body;

  try {
    let query = "";
    let values = [];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = "UPDATE admins SET email = $1, password = $2, name = $3 WHERE id = $4 RETURNING id, email, name, last_login";
      values = [email, hashedPassword, name, id];
    } else {
      query = "UPDATE admins SET email = $1, name = $2 WHERE id = $3 RETURNING id, email, name, last_login";
      values = [email, name, id];
    }

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error updating admin:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete admin
const deleteAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM admins WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({ message: "Admin deleted successfully" });
  } catch (err) {
    console.error("Error deleting admin:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getAllAdmins,
  getAdminById,
  loginAdmin,
  createAdmin,
  updateAdmin,
  deleteAdmin,
};
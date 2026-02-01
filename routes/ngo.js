const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; // use .env file

// ======================= NGO REGISTER =======================
router.post("/register", async (req, res) => {
  const { name, email, password, phone, address } = req.body;

  if (!name || !email || !password || !phone || !address) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }

  try {
    // check if NGO already exists
    const [existing] = await db.query(
      "SELECT id FROM ngos WHERE email = ?",
      [email]
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // save NGO
    await db.query(
      "INSERT INTO ngos (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)",
      [name, email, hashedPassword, phone, address]
    );

    res.json({ success: true, message: "NGO registered successfully" });
  } catch (err) {
    console.error("Error in /ngo/register:", err);
    res.status(500).json({ success: false, message: "Error registering NGO" });
  }
});

// ======================= NGO LOGIN =======================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Email and password required" });
  }

  try {
    const [ngos] = await db.query("SELECT * FROM ngos WHERE email = ?", [
      email,
    ]);
    if (ngos.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "NGO not found" });
    }

    const ngo = ngos[0];

    // compare password
    const isMatch = await bcrypt.compare(password, ngo.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }

    // generate JWT
    const token = jwt.sign({ id: ngo.id, role: "ngo" }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      success: true,
      token,
      ngo: { id: ngo.id, name: ngo.name, email: ngo.email },
    });
  } catch (err) {
    console.error("Error in /ngo/login:", err);
    res.status(500).json({ success: false, message: "Login error" });
  }
});

// ======================= GET DONATIONS FOR SPECIFIC NGO =======================
router.get("/:id/donations", async (req, res) => {
  const { id } = req.params;

  try {
    const [donations] = await db.query(
      `SELECT d.id, d.item_name, d.quantity, d.created_at, d.status,
              u.name AS donor_name, u.email AS donor_email
       FROM donations d
       JOIN users u ON d.user_id = u.id
       WHERE d.ngo_id = ?
       ORDER BY d.created_at DESC`,
      [id]
    );

    res.json({ success: true, donations });
  } catch (err) {
    console.error("Error in GET /ngo/:id/donations:", err);
    res
      .status(500)
      .json({ success: false, message: "Error fetching donations" });
  }
});

module.exports = router;

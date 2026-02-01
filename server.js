// ======================
// LOAD ENV
// ======================
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// ======================
// MIDDLEWARE
// ======================
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ======================
// MYSQL CONNECTION
// ======================
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
});

(async () => {
  try {
    const connection = await db.getConnection();
    console.log("✅ Connected to MySQL database!");
    connection.release();
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
  }
})();

// ======================
// FILE UPLOAD SETUP (LOCAL)
// ======================
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

// ======================
// TEST ROUTE
// ======================
app.get("/", (_, res) => {
  res.send("Backend is running!");
});

// ======================
// USER ROUTES
// ======================
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.json({
        success: false,
        message: "All fields are required.",
      });
    }

    const query =
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
    const [result] = await db.query(query, [
      name,
      email,
      password,
    ]);

    res.json({ success: true, userId: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.json({
        success: false,
        message: "Email already registered.",
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [results] = await db.query(
      "SELECT * FROM users WHERE email = ? AND password = ?",
      [email, password]
    );

    if (results.length === 0) {
      return res.json({
        success: false,
        message: "Invalid credentials",
      });
    }

    res.json({ success: true, user: results[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================
// NGO ROUTES
// ======================
app.post("/ngo/register", async (req, res) => {
  try {
    const { name, email, password, phone, address, description } =
      req.body;

    if (!name || !email || !password || !phone || !address) {
      return res.json({
        success: false,
        message: "All required fields are needed.",
      });
    }

    const query = `
      INSERT INTO ngos (name, email, password, phone, address, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      name,
      email,
      password,
      phone,
      address,
      description,
    ]);

    res.json({ success: true, ngoId: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.json({
        success: false,
        message: "NGO already registered.",
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/ngo/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [results] = await db.query(
      "SELECT * FROM ngos WHERE email = ? AND password = ?",
      [email, password]
    );

    if (results.length === 0) {
      return res.json({
        success: false,
        message: "Invalid credentials",
      });
    }

    res.json({ success: true, ngo: results[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/ngos", async (_, res) => {
  const [results] = await db.query(
    "SELECT id, name FROM ngos"
  );
  res.json({ success: true, ngos: results });
});

// ======================
// DONATIONS
// ======================
app.post("/donate", upload.single("photo"), async (req, res) => {
  try {
    const { user_id, category, quantity, address, notes, ngo_id } =
      req.body;

    const photo = req.file ? req.file.filename : null;

    if (!user_id || !category || !quantity || !address || !ngo_id) {
      return res.json({
        success: false,
        message: "All required fields are needed.",
      });
    }

    const query = `
      INSERT INTO donations 
      (user_id, category, quantity, address, notes, ngo_id, photo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(query, [
      user_id,
      category,
      quantity,
      address,
      notes || null,
      ngo_id,
      photo,
    ]);

    res.json({
      success: true,
      message: "Donation submitted successfully!",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================
// VOLUNTEER ROUTES
// ======================
app.post("/api/join-ngo", async (req, res) => {
  try {
    const userId = parseInt(req.body.userId);
    const ngoId = parseInt(req.body.ngoId);

    const [exists] = await db.query(
      "SELECT * FROM volunteer_requests WHERE user_id = ? AND ngo_id = ?",
      [userId, ngoId]
    );

    if (exists.length > 0) {
      return res.json({
        success: false,
        message: "Request already sent.",
      });
    }

    await db.query(
      `INSERT INTO volunteer_requests 
       (user_id, ngo_id, status, created_at)
       VALUES (?, ?, 'Pending', NOW())`,
      [userId, ngoId]
    );

    res.json({
      success: true,
      message: "Volunteer request sent successfully!",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================
// NGO STATS
// ======================
app.get("/ngo/:id/stats", async (req, res) => {
  try {
    const ngoId = req.params.id;

    const [[donations]] = await db.query(
      "SELECT COUNT(*) AS total FROM donations WHERE ngo_id = ? AND status = 'Approved'",
      [ngoId]
    );

    const [[pending]] = await db.query(
      "SELECT COUNT(*) AS pending FROM donations WHERE ngo_id = ? AND status = 'Pending'",
      [ngoId]
    );

    const [[volunteers]] = await db.query(
      "SELECT COUNT(*) AS volunteers FROM volunteer_requests WHERE ngo_id = ? AND status = 'Approved'",
      [ngoId]
    );

    res.json({
      success: true,
      totalDonations: donations.total,
      pending: pending.pending,
      volunteers: volunteers.volunteers,
    });
  } catch (err) {
    console.error("Error fetching NGO stats:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching stats.",
    });
  }
});

// ======================
// START SERVER
// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

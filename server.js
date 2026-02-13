// ======================
// LOAD ENV & IMPORTS
// ======================
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const app = express();
const PORT = process.env.PORT || 5000;

// ======================
// MIDDLEWARE
// ======================
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:3000",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ======================
// MONGODB CONNECTION
// ======================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ======================
// SCHEMAS & MODELS
// ======================
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
});

const NgoSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  address: String,
  description: String,
});

const DonationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ngo_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ngo",
      required: true,
    },
    category: { type: String, required: true },
    quantity: { type: Number, required: true },
    address: { type: String, required: true },
    notes: String,
    photo: { type: String, required: true },
    status: { type: String, default: "Pending" },
  },
  { timestamps: true }
);


const VolunteerRequestSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  ngo_id: { type: mongoose.Schema.Types.ObjectId, ref: "Ngo" },
  status: { type: String, default: "Pending" },
  created_at: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Ngo = mongoose.model("Ngo", NgoSchema);
const Donation = mongoose.model("Donation", DonationSchema);
const VolunteerRequest = mongoose.model("VolunteerRequest", VolunteerRequestSchema);

// // ======================
// // FILE UPLOAD SETUP
// // ======================
// ======================
// FILE UPLOAD SETUP (UPDATED – SAFE)
// ======================
const uploadDir = path.join(__dirname, "uploads");

// Ensure uploads folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, JPEG, PNG images are allowed"));
    }

    cb(null, true);
  },
});


// ======================
// TEST ROUTE
// ======================
app.get("/", (_, res) => res.send("Backend is running!"));

// ======================
// USER ROUTES
// ======================
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, password: hashedPassword });
    res.json({ success: true, userId: user._id });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.json({ success: false, message: "Invalid credentials" });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ======================
// NGO ROUTES
// ======================
app.post("/ngo/register", async (req, res) => {
  try {
    const { name, email, password, phone, address, description } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const ngo = await Ngo.create({ name, email, password: hashedPassword, phone, address, description });
    res.json({ success: true, ngoId: ngo._id });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});
//NGO_Login
app.post("/ngo/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const ngo = await Ngo.findOne({ email });
    if (!ngo) return res.json({ success: false, message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, ngo.password);
    if (!valid) return res.json({ success: false, message: "Invalid credentials" });

    res.json({ success: true, ngo });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/ngos", async (_, res) => {
  try {
    const ngos = await Ngo.find({}, { name: 1, description: 1 });
    res.json({ success: true, ngos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
////////////////////
// DONATE ROUTE //
///////////////////
app.post("/donate", upload.single("photo"), async (req, res) => {
  try {
    const { user_id, ngo_id, category, quantity, address, notes } = req.body;

    // 1. Validate required fields
    if (!user_id || !ngo_id || !category || !quantity || !address) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    // 2. Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(user_id) ||
      !mongoose.Types.ObjectId.isValid(ngo_id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user or NGO ID",
      });
    }

    // 3. Validate quantity
    if (Number(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    // 4. Validate photo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo is required",
      });
    }

    // 5. Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "donations",
    });

    // 6. Save donation
    const donation = await Donation.create({
      user_id,
      ngo_id,
      category,
      quantity: Number(quantity),
      address,
      notes,
      photo: result.secure_url,
    });

    // 7. Cleanup temp file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Temp file cleanup failed:", err);
    });

    res.json({
      success: true,
      message: "Donation submitted successfully",
      donation,
    });
  } catch (err) {
    console.error("Donate route error:", err);
    res.status(500).json({
      success: false,
      message: "Donation failed",
    });
  }
});



// ======================
// NGO STATS
// ======================
app.get("/ngo/:id/stats", async (req, res) => {
  try {
    const ngoId = req.params.id;

    const totalDonations = await Donation.countDocuments({ ngo_id: ngoId, status: "Approved" });
    const pending = await Donation.countDocuments({ ngo_id: ngoId, status: "Pending" });
    const volunteers = await VolunteerRequest.countDocuments({ ngo_id: ngoId, status: "Approved" });

    res.json({ success: true, totalDonations, pending, volunteers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



// ======================
// GET DONATIONS FOR USER
// ======================
app.get("/donations", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const donations = await Donation.find({ user_id: userId })
      .populate("ngo_id", "name") // optional, populate NGO name
      .sort({ createdAt: -1 }); // newest first

    res.json({ success: true, donations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ======================
// EDIT USER PROFILE
// ======================
app.put("/edit-profile", async (req, res) => {
  try {
    const { _id, name, email, password } = req.body;

    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const updateData = { name, email };

    // update password only if provided
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    const updatedUser = await User.findByIdAndUpdate(
      _id,
      updateData,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
      },
    });
  } catch (err) {
    console.error("Edit profile error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
// ======================
// GET SINGLE DONATION BY ID
// ======================
app.get("/donation/:id", async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate("ngo_id", "name");

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: "Donation not found",
      });
    }

    res.json({
      success: true,
      donation: {
        ...donation.toObject(),
        ngo_name: donation.ngo_id?.name || null,
      },
    });
  } catch (err) {
    console.error("Get donation error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
//get ngo
app.get("/ngos", async (_, res) => {
  try {
    const ngos = await Ngo.find({}, { name: 1, description: 1 });
    res.json({ success: true, ngos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 app.put("/volunteer/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const requestId = req.params.id;

    const updated = await VolunteerRequest.findByIdAndUpdate(
      requestId,
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Request not found" });

    res.json({ success: true, request: updated });
  } catch (err) {
    console.error("Update volunteer request status error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// get approve
app.get("/ngo/:id/volunteers", async (req, res) => {
  try {
    const ngoId = req.params.id;

    const volunteers = await VolunteerRequest.find({ ngo_id: ngoId, status: "Approved" })
      .populate("user_id", "name email")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      volunteers: volunteers.map((v) => ({
        _id: v._id,
        volunteer_name: v.user_id?.name,
        volunteer_email: v.user_id?.email,
        joined_at: v.created_at,
      })),
    });
  } catch (err) {
    console.error("Fetch volunteers error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ======================
// GET VOLUNTEER REQUESTS FOR NGO (UPDATED)
// ======================
app.get("/ngo/:id/volunteer-requests", async (req, res) => {
  try {
    const ngoId = req.params.id;

    const requests = await VolunteerRequest.find({ ngo_id: ngoId })
      .populate("user_id", "name email")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      requests: requests.map((r) => ({
        _id: r._id,
        status: r.status,
        user: {
          name: r.user_id?.name || "Unknown User",
          email: r.user_id?.email || "N/A",
        },
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error("Fetch volunteer requests error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ======================
// GET APPROVED VOLUNTEERS FOR NGO
// ======================
app.get("/ngo/:id/volunteers", async (req, res) => {
  try {
    const ngoId = req.params.id;

    const volunteers = await VolunteerRequest.find({
      ngo_id: ngoId,
      status: "Approved",
    })
      .populate("user_id", "name email")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      volunteers: volunteers.map((v) => ({
        _id: v._id,
        volunteer_name: v.user_id?.name || "Unknown",
        volunteer_email: v.user_id?.email || "N/A",
        joined_at: v.created_at,
      })),
    });
  } catch (err) {
    console.error("Fetch volunteers error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
// ======================
// GET VOLUNTEER REQUESTS FOR NGO
// ======================
app.get("/ngo/:id/volunteer-requests", async (req, res) => {
  try {
    const ngoId = req.params.id;

    const requests = await VolunteerRequest.find({ ngo_id: ngoId })
      .populate("user_id", "name email")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      requests: requests.map((r) => ({
        _id: r._id,
        status: r.status,
        user: {
          name: r.user_id?.name || "Unknown User",
          email: r.user_id?.email || "N/A",
        },
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error("Fetch volunteer requests error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


// ======================
// GET DONATIONS FOR NGO
// ======================
app.get("/ngo/:id/donations", async (req, res) => {
  try {
    const ngoId = req.params.id;

    const donations = await Donation.find({ ngo_id: ngoId }).populate("user_id", "name email");

    const formatted = donations.map((d) => ({
      _id: d._id,
      category: d.category,
      quantity: d.quantity,
      status: d.status,
      donor_name: d.user_id?.name || "Anonymous",
      donor_email: d.user_id?.email || "N/A",
      created_at: d.createdAt,
    }));

    res.json({ success: true, donations: formatted });
  } catch (err) {
    console.error("Error fetching NGO donations:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// ======================
// UPDATE DONATION STATUS (NGO)
// ======================
app.put("/donations/:id/status", async (req, res) => {
  try {
    const donationId = req.params.id;
    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const donation = await Donation.findByIdAndUpdate(
      donationId,
      { status },
      { new: true }
    );

    if (!donation) return res.status(404).json({ success: false, message: "Donation not found" });

    res.json({ success: true, donation });
  } catch (err) {
    console.error("Error updating donation status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// ======================
// GET ALL DONATIONS FOR NGO
// ======================
app.get("/ngo/:id/donations", async (req, res) => {
  try {
    const ngoId = req.params.id;

    // Fetch donations and populate user info
    const donations = await Donation.find({ ngo_id: ngoId }).populate("user_id", "name email");

    const formatted = donations.map((d) => ({
      _id: d._id,
      category: d.category,
      quantity: d.quantity,
      address: d.address,
      status: d.status,
      donor_name: d.user_id?.name || "Anonymous",
      donor_email: d.user_id?.email || "N/A",
      created_at: d.createdAt,
    }));

    res.json({ success: true, donations: formatted });
  } catch (err) {
    console.error("Error fetching NGO donations:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ======================
// UPDATE DONATION STATUS
// ======================
app.put("/donations/:id/status", async (req, res) => {
  try {
    const donationId = req.params.id;
    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const donation = await Donation.findByIdAndUpdate(
      donationId,
      { status },
      { new: true }
    );

    if (!donation) return res.status(404).json({ success: false, message: "Donation not found" });

    res.json({ success: true, donation });
  } catch (err) {
    console.error("Error updating donation status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// ======================
// CANCEL VOLUNTEER REQUEST
// ======================
app.delete("/volunteer/:id/cancel", async (req, res) => {
  try {
    const requestId = req.params.id;

    const request = await VolunteerRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    // Only allow cancel if status is Pending
    if (request.status !== "Pending") {
      return res.status(400).json({ success: false, message: "Only pending requests can be canceled" });
    }

    await VolunteerRequest.findByIdAndDelete(requestId);

    res.json({ success: true, message: "Volunteer request canceled successfully" });
  } catch (err) {
    console.error("Error cancelling volunteer request:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ======================
// JOIN NGO (CREATE VOLUNTEER REQUEST)
// ======================
app.post("/volunteer/join", async (req, res) => {
  try {
    const { userId, ngoId } = req.body;

    if (!userId || !ngoId) {
      return res.status(400).json({
        success: false,
        message: "User ID and NGO ID are required",
      });
    }

    // Check if already requested
    const existingRequest = await VolunteerRequest.findOne({
      user_id: userId,
      ngo_id: ngoId,
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "You have already requested to join this NGO",
      });
    }

    const request = await VolunteerRequest.create({
      user_id: userId,
      ngo_id: ngoId,
      status: "Pending",
    });

    res.json({
      success: true,
      message: "Volunteer request sent successfully",
      request,
    });
  } catch (err) {
    console.error("Join NGO error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ======================
// GET VOLUNTEER REQUESTS FOR USER
// ======================
app.get("/volunteer/my-requests/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const requests = await VolunteerRequest.find({ user_id: userId })
      .populate("ngo_id", "name")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      requests: requests.map((r) => ({
        _id: r._id,
        status: r.status,
        ngo_name: r.ngo_id?.name || "Unknown NGO",
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error("Fetch user volunteer requests error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


// ======================
// START SERVER
// ======================
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

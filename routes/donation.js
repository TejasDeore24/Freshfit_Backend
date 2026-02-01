const express = require("express");
const router = express.Router();
const db = require("../db"); // tumhara DB connection
// Get total donations for NGO
const approveDonation = (donationId) => {
  fetch(`http://localhost:5000/donation/${donationId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Approved" }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // UI update ke liye state modify karo
        setDonations(prev => prev.map(d => d.id === donationId ? {...d, status: "Approved"} : d));
      }
    });
};

app.get("/ngo/:id/stats", (req, res) => {
  const ngoId = req.params.id;

  if (!ngoId) {
    return res.json({ success: false, message: "NGO ID required" });
  }

  // Total donations count and pending count
  const query = `
    SELECT 
      COUNT(*) AS totalDonations,
      SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) AS pendingRequests
    FROM donations
    WHERE ngo_id = ?
  `;

  db.query(query, [ngoId], (err, results) => {
    if (err) return res.json({ success: false, message: err.message });

    res.json({
      success: true,
      totalDonations: results[0].totalDonations,
      pending: results[0].pendingRequests,
    });
  });
});

// Create Donation
router.post("/create", async (req, res) => {
  const { user_id, category, quantity, address, notes, ngo_id } = req.body;

  if (!user_id || !category || !quantity || !ngo_id) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    await db.query(
      "INSERT INTO donations (user_id, category, quantity, address, notes, ngo_id) VALUES (?, ?, ?, ?, ?, ?)",
      [user_id, category, quantity, address, notes, ngo_id]
    );

    res.json({ success: true, message: "Donation created successfully" });
  } catch (err) {
    console.error("Error in /donation/create:", err);
    res.status(500).json({ success: false, message: "Error creating donation" });
  }
});

module.exports = router;

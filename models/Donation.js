const mongoose = require("mongoose");

const DonationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  ngo_id: { type: mongoose.Schema.Types.ObjectId, ref: "Ngo" },
  item_name: String,
  quantity: String,
  status: { type: String, default: "Pending" },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Donation", DonationSchema);

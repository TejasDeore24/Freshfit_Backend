// Register
const registerUser = (req, res) => {
  res.json({ message: "Register endpoint working ✅" });
};

// Login
const loginUser = (req, res) => {
  res.json({ message: "Login endpoint working ✅" });
};

module.exports = { registerUser, loginUser };

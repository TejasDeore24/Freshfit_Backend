const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Ngo = require("../models/ngo");
const Donation = require("../models/Donation");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

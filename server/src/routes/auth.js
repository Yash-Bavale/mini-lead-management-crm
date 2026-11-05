const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { email: admin.email },
      process.env.JWT_SECRET,
      { subject: admin.id, expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
    res.json({ token, admin: { id: admin.id, email: admin.email } });
  } catch (error) { next(error); }
});

router.get("/me", requireAdmin, async (req, res) => {
  res.json({ admin: req.admin });
});

module.exports = router;

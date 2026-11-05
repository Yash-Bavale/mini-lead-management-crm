require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const leadRoutes = require("./routes/leads");
const prisma = require("./db");

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  throw new Error("DATABASE_URL and JWT_SECRET must be configured.");
}

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/leads", leadRoutes);

app.use((req, res) => res.status(404).json({ error: "Route not found." }));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const port = process.env.PORT || 5000;
const server = app.listen(port, () => console.log(`CRM API listening on port ${port}`));

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

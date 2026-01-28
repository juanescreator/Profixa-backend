import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath =
  process.env.NODE_ENV === "production"
    ? "/tmp/profixa.db"
    : path.join(__dirname, "../db/profixa.db");

const db = new sqlite3.Database(dbPath);

router.post("/admin-login", (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password requerida" });
  }

  db.get(`SELECT * FROM admins LIMIT 1`, async (err, admin) => {
    if (err) {
      return res.status(500).json({ error: "DB error" });
    }

    if (!admin) {
      return res.status(401).json({ error: "Admin no existe" });
    }

    const valid = await bcrypt.compare(password, admin.password);

    if (!valid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      { adminId: admin.id },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token });
  });
});

export default router;

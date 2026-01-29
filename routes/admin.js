import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

/* =========================
   PATHS
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath =
  process.env.NODE_ENV === "production"
    ? "/tmp/profixa.db"
    : path.join(__dirname, "../db/profixa.db");

const db = new sqlite3.Database(dbPath);

/* =========================
   ADMIN LOGIN
========================= */
router.post("/login", (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password requerida" });
  }

  db.get(`SELECT * FROM admins LIMIT 1`, async (err, admin) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "DB error" });
    }

    if (!admin) {
      return res.status(401).json({ error: "Admin no existe" });
    }

    try {
      const valid = await bcrypt.compare(password, admin.password);

      if (!valid) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      const token = jwt.sign(
        { adminId: admin.id, admin: true },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
      );

      res.json({ token });

    } catch (error) {
      console.error("bcrypt error:", error);
      res.status(500).json({ error: "Error interno" });
    }
  });
});

export default router;

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mercadopago from "mercadopago";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// CONFIGURACIÓN
// ==========================
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

// ==========================
// MERCADO PAGO
// ==========================
mercadopago.configure({
  access_token: MP_ACCESS_TOKEN
});

// ==========================
// SQLITE (OBLIGATORIO /tmp)
// ==========================
const db = new sqlite3.Database("/tmp/profixa.db", (err) => {
  if (err) {
    console.error("❌ Error abriendo SQLite:", err);
  } else {
    console.log("✅ SQLite conectado");
  }
});

// ==========================
// CREAR TABLA ADMIN
// ==========================
db.run(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    password TEXT NOT NULL
  )
`);

// ==========================
// INSERTAR ADMIN SI NO EXISTE
// ==========================
db.get(`SELECT * FROM admins LIMIT 1`, async (err, row) => {
  if (!row) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    db.run(`INSERT INTO admins (password) VALUES (?)`, [hash]);
    console.log("✅ Admin creado");
  }
});

// ==========================
// LOGIN ADMIN
// ==========================
app.post("/admin-login", (req, res) => {
  const { password } = req.body;

  db.get(`SELECT * FROM admins LIMIT 1`, async (err, admin) => {
    if (!admin) {
      return res.status(401).json({ error: "Admin no existe" });
    }

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) {
      return res.status(401).json({ error: "Password incorrecto" });
    }

    const token = jwt.sign({ admin: true }, JWT_SECRET, {
      expiresIn: "1d"
    });

    res.json({ token });
  });
});

// ==========================
// MIDDLEWARE ADMIN
// ==========================
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.sendStatus(401);

  try {
    jwt.verify(auth.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    res.sendStatus(401);
  }
}

// ==========================
// MERCADO PAGO - CREAR PREFERENCIA
// ==========================
app.post("/crear-preferencia", async (req, res) => {
  try {
    const preference = {
      items: req.body.items,
      back_urls: {
        success: req.body.success_url,
        failure: req.body.failure_url
      },
      auto_return: "approved"
    };

    const response = await mercadopago.preferences.create(preference);
    res.json({ init_point: response.body.init_point });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error Mercado Pago" });
  }
});

// ==========================
// WEBHOOK
// ==========================
app.post("/webhook", (req, res) => {
  console.log("🔔 Webhook recibido:", req.body);
  res.sendStatus(200);
});

// ==========================
// ROOT
// ==========================
app.get("/", (req, res) => {
  res.send("ProFixa Backend OK 🚀");
});

// ==========================
app.listen(PORT, () => {
  console.log(`🚀 Server corriendo en puerto ${PORT}`);
});

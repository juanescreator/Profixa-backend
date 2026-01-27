// ===============================
// IMPORTS
// ===============================
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import MercadoPago from "mercadopago";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();

/* ===============================
   MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());

/* ===============================
   PATHS (IMPORTANTE PARA RAILWAY)
================================ */
const __dirname = new URL(".", import.meta.url).pathname;

// Crear carpeta db si NO existe (Railway FIX)
const dbDir = path.join(__dirname, "db");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// Ruta absoluta de la DB
const dbPath = path.join(dbDir, "profixa.db");

/* ===============================
   SQLITE CONFIG
================================ */
const dbPromise = open({
  filename: dbPath,
  driver: sqlite3.Database,
});

/* ===============================
   INIT DATABASE
================================ */
(async () => {
  const db = await dbPromise;

  // Tabla reservas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profesional TEXT,
      categoria TEXT,
      ciudad TEXT,
      precio INTEGER,
      estado TEXT DEFAULT 'pendiente',
      preference_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla admins (para login)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("✅ Base de datos inicializada");
})();

/* ===============================
   MERCADO PAGO CONFIG
================================ */
if (!process.env.MP_ACCESS_TOKEN) {
  console.error("❌ MP_ACCESS_TOKEN no definido");
  process.exit(1);
}

const mp = new MercadoPago({
   accesstoken: process.env.MP_ACCESS_TOKEN,
});

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "ProFixa backend activo 🚀",
  });
});

/* ===============================
   CREAR PREFERENCIA
================================ */
app.post("/crear-preferencia", async (req, res) => {
  try {
    const { profesional, categoria, ciudad, precio } = req.body;

    if (!profesional || !categoria || !ciudad || !precio) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const db = await dbPromise;

    // Guardar reserva
    const result = await db.run(
      `INSERT INTO reservas (profesional, categoria, ciudad, precio)
       VALUES (?, ?, ?, ?)`,
      [profesional, categoria, ciudad, precio]
    );

    const reservaId = result.lastID;

    const preference = {
      items: [
        {
          title: `${categoria} - ${profesional}`,
          quantity: 1,
          unit_price: Number(precio),
          currency_id: "COP",
        },
      ],
      back_urls: {
        success: "https://profixa.netlify.app/success",
        failure: "https://profixa.netlify.app/failure",
        pending: "https://profixa.netlify.app/pending",
      },
      auto_return: "approved",
      external_reference: reservaId.toString(),
      notification_url: `${process.env.BASE_URL}/webhook`,
    };

    const response = await mercadopago.preferences.create(preference);

    await db.run(
      `UPDATE reservas SET preference_id = ? WHERE id = ?`,
      [response.body.id, reservaId]
    );

    res.json({
      init_point: response.body.init_point,
    });
  } catch (error) {
    console.error("❌ Error creando preferencia:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

/* ===============================
   OBTENER RESERVAS (ADMIN)
================================ */
app.get("/reservas", async (req, res) => {
  try {
    const db = await dbPromise;
    const reservas = await db.all(
      `SELECT * FROM reservas ORDER BY created_at DESC`
    );
    res.json(reservas);
  } catch (error) {
    console.error("❌ Error obteniendo reservas:", error);
    res.status(500).json({ error: "Error obteniendo reservas" });
  }
});

/* ===============================
   WEBHOOK MERCADO PAGO
================================ */
app.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;

    if (!paymentId) {
      return res.sendStatus(200);
    }

    let payment;
    try {
      payment = await mercadopago.payment.findById(paymentId);
    } catch (err) {
      console.warn("⚠️ Pago no encontrado:", paymentId);
      return res.sendStatus(200);
    }

    const status = payment.body.status;
    const reservaId = payment.body.external_reference;

    if (!reservaId) return res.sendStatus(200);

    const db = await dbPromise;

    if (status === "approved") {
      await db.run(
        "UPDATE reservas SET estado = 'pagado' WHERE id = ?",
        [reservaId]
      );
    }

    if (status === "rejected" || status === "cancelled") {
      await db.run(
        "UPDATE reservas SET estado = 'fallida' WHERE id = ?",
        [reservaId]
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("🔥 Error webhook:", error);
    res.sendStatus(200);
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 ProFixa backend activo en puerto ${PORT}`);
});


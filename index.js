// ===============================
// IMPORTS
// ===============================
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import fs from "fs";
import path from "path";

// ===============================
// ENV
// ===============================
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ===============================
// MIDDLEWARE
// ===============================
app.use(cors());
app.use(express.json());

// ===============================
// DATABASE PATH (CRÍTICO PARA RAILWAY)
// ===============================
const dbDir = path.resolve("./db");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPromise = open({
  filename: path.join(dbDir, "profixa.db"),
  driver: sqlite3.Database,
});

// ===============================
// INIT DB
// ===============================
(async () => {
  const db = await dbPromise;

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("✅ Base de datos lista");
})();

// ===============================
// MERCADO PAGO CONFIG (FORMA CORRECTA)
// ===============================
const mpConfig = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const preferenceClient = new Preference(mpConfig);
const paymentClient = new Payment(mpConfig);

// ===============================
// HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.json({ ok: true, message: "ProFixa backend activo" });
});

// ===============================
// CREAR PREFERENCIA
// ===============================
app.post("/crear-preferencia", async (req, res) => {
  try {
    const { profesional, categoria, ciudad, precio } = req.body;

    if (!profesional || !categoria || !ciudad || !precio) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const db = await dbPromise;

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

    const response = await preferenceClient.create({ body: preference });

    await db.run(
      "UPDATE reservas SET preference_id = ? WHERE id = ?",
      [response.id, reservaId]
    );

    res.json({ init_point: response.init_point });
  } catch (error) {
    console.error("❌ Error creando preferencia:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

// ===============================
// WEBHOOK MERCADO PAGO (ANTI-CRASH)
// ===============================
app.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    let payment;
    try {
      payment = await paymentClient.get({ id: paymentId });
    } catch {
      return res.sendStatus(200);
    }

    const status = payment.status;
    const reservaId = payment.external_reference;

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
  } catch (err) {
    console.error("🔥 Webhook error:", err);
    res.sendStatus(200);
  }
});

// ===============================
// LISTAR RESERVAS (ADMIN)
// ===============================
app.get("/reservas", async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all(
      "SELECT * FROM reservas ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error obteniendo reservas" });
  }
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 ProFixa backend corriendo en puerto ${PORT}`);
});

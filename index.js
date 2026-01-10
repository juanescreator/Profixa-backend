import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mercadopago from "mercadopago";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

dotenv.config();

/* =========================
   APP
========================= */
const app = express();
app.use(cors());
app.use(express.json());

// Servir frontend (opcional)
app.use(express.static("public"));

/* =========================
   MERCADO PAGO
========================= */
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

/* =========================
   SQLITE
========================= */
const dbPromise = open({
  filename: "./db/profixa.db",
  driver: sqlite3.Database
});

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
})();

/* =========================
   HEALTH CHECK (RAILWAY)
========================= */
app.get("/", (req, res) => {
  res.json({ status: "ProFixa backend online" });
});

/* =========================
   CREAR PREFERENCIA
========================= */
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
          currency_id: "COP"
        }
      ],
      back_urls: {
        success: "https://profixa.app/checkout.html",
        failure: "https://profixa.app/checkout.html",
        pending: "https://profixa.app/checkout.html"
      },
      external_reference: reservaId.toString(),
      auto_return: "approved"
    };

    const response = await mercadopago.preferences.create(preference);

    await db.run(
      `UPDATE reservas SET preference_id = ? WHERE id = ?`,
      [response.body.id, reservaId]
    );

    res.json({
      init_point: response.body.init_point,
      sandbox_init_point: response.body.sandbox_init_point
    });

  } catch (error) {
    console.error("❌ Error creando preferencia:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

/* =========================
   OBTENER RESERVAS (ADMIN)
========================= */
app.get("/reservas", async (req, res) => {
  try {
    const db = await dbPromise;

    const reservas = await db.all(`
      SELECT * FROM reservas
      ORDER BY created_at DESC
    `);

    res.json(reservas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo reservas" });
  }
});

/* =========================
   WEBHOOK MERCADO PAGO
========================= */
app.post("/webhook", async (req, res) => {
  try {
    console.log("🔔 Webhook recibido:", req.body);

    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

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
      console.log("✅ Reserva pagada:", reservaId);
    }

    if (status === "rejected" || status === "cancelled") {
      await db.run(
        "UPDATE reservas SET estado = 'fallida' WHERE id = ?",
        [reservaId]
      );
      console.log("❌ Reserva fallida:", reservaId);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("🔥 Error crítico webhook:", error);
    res.sendStatus(200);
  }
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`ProFixa backend activo en puerto ${PORT}`);
});

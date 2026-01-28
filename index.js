import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

import MercadoPago from "mercadopago";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARES
========================= */
app.use(cors());
app.use(express.json());

/* =========================
   DATABASE (SQLite)
========================= */
const db = await open({
  filename: "./db/profixa.db",
  driver: sqlite3.Database
});

/* =========================
   MERCADO PAGO (SDK NUEVO)
========================= */
const mp = new MercadoPago({
  accessToken: process.env.MP_ACCESS_TOKEN
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.json({
    status: "ProFixa backend running",
    env: process.env.NODE_ENV || "production"
  });
});

/* =========================
   ADMIN ROUTES
========================= */
app.use("/admin", adminRoutes);

/* =========================
   CREAR PREFERENCIA
========================= */
app.post("/crear-preferencia", async (req, res) => {
  try {
    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const preference = await mp.preferences.create({
      body: {
        items: [
          {
            title,
            quantity: 1,
            unit_price: Number(price),
            currency_id: "COP"
          }
        ],
        back_urls: {
          success: "https://profixa.com/success",
          failure: "https://profixa.com/failure",
          pending: "https://profixa.com/pending"
        },
        auto_return: "approved",
        notification_url: `${process.env.BASE_URL}/webhook`
      }
    });

    res.json({
      id: preference.id,
      init_point: preference.init_point
    });

  } catch (error) {
    console.error("Error creando preferencia:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

/* =========================
   WEBHOOK MERCADO PAGO
========================= */
app.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;

    if (!paymentId) {
      return res.sendStatus(200);
    }

    const payment = await mp.payment.get(paymentId);

    console.log("📩 Webhook recibido:");
    console.log({
      id: payment.id,
      status: payment.status,
      amount: payment.transaction_amount
    });

    // aquí luego guardaremos en SQLite

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(200);
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 ProFixa backend listening on port ${PORT}`);
});

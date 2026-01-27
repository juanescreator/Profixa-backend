import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

dotenv.config();

/* =========================
   APP
========================= */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* =========================
   MERCADO PAGO (SDK NUEVO)
========================= */
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);

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
        success: "https://tu-frontend.netlify.app/checkout.html",
        failure: "https://tu-frontend.netlify.app/checkout.html",
        pending: "https://tu-frontend.netlify.app/checkout.html"
      },
      external_reference: reservaId.toString(),
      auto_return: "approved"
    };

    const response = await preferenceClient.create({
      body: preference
    });

    await db.run(
      `UPDATE reservas SET preference_id = ? WHERE id = ?`,
      [response.id, reservaId]
    );

    res.json({
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point
    });

  } catch (error) {
    console.error("MP ERROR:", error);
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
   LOGIN ADMIN
========================= */

app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const db = await dbPromise;

    const admin = await db.get(
      "SELECT * FROM admins WHERE email = ?",
      [email]
    );

    if (!admin) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const passwordOk = await bcrypt.compare(password, admin.password);

    if (!passwordOk) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token });
  } catch (error) {
    console.error("❌ Error login admin:", error);
    res.status(500).json({ error: "Error interno" });
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

    let payment;

    try {
      payment = await paymentClient.get({ id: paymentId });
    } catch (err) {
      console.warn("Pago no encontrado:", paymentId);
      return res.sendStatus(200);
    }

    const status = payment.status;
    const reservaId = payment.external_reference;

    if (!reservaId) {
      return res.sendStatus(200);
    }

    const db = await dbPromise;

    if (status === "approved") {
      await db.run(
        "UPDATE reservas SET estado = 'pagado' WHERE id = ?",
        [reservaId]
      );
      console.log("Reserva pagada:", reservaId);
    }

    if (status === "rejected" || status === "cancelled") {
      await db.run(
        "UPDATE reservas SET estado = 'fallida' WHERE id = ?",
        [reservaId]
      );
      console.log("Reserva fallida:", reservaId);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
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

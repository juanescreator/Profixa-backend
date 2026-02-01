import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import MercadoPago from "mercadopago";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

/* =========================
   CORS CONFIG (NETLIFY)
========================= */
app.use(
  cors({
    origin: "https://profixa.netlify.app",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

/* =========================
   MERCADO PAGO
========================= */
const mp = new MercadoPago({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "ProFixa backend running",
  });
});

/* =========================
   CREAR PREFERENCIA REAL
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
            currency_id: "COP",
          },
        ],
        back_urls: {
          success: "https://profixa.netlify.app/exito.html",
          failure: "https://profixa.netlify.app/error.html",
          pending: "https://profixa.netlify.app/pendiente.html",
        },
        auto_return: "approved",
      },
    });

    res.json({
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    });

  } catch (error) {
    console.error("❌ Mercado Pago error:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

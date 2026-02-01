import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import MercadoPagoConfig, { Preference } from "mercadopago";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   CORS
========================= */
app.use(
  cors({
    origin: ["https://profixa.netlify.app"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

/* =========================
   MERCADO PAGO CONFIG
========================= */
if (!process.env.MP_ACCESS_TOKEN) {
  throw new Error("❌ MP_ACCESS_TOKEN no está definido");
}

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const preference = new Preference(mpClient);

/* =========================
   HEALTH
========================= */
app.get("/", (req, res) => {
  res.json({ status: "OK ProFixa backend running" });
});

/* =========================
   CREAR PREFERENCIA
========================= */
app.post("/crear-preferencia", async (req, res) => {
  try {
    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const result = await preference.create({
      body: {
        items: [
          {
            title,
            quantity: 1,
            currency_id: "COP",
            unit_price: Number(price),
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
      checkout_url: result.init_point,
    });
  } catch (error) {
    console.error("❌ MercadoPago error:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

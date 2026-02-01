import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import MercadoPago from "mercadopago";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   CORS CONFIG (CORRECTO)
========================= */
app.use(
  cors({
    origin: "https://profixa.netlify.app",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// 👇 ESTO ES CLAVE PARA EL PREFLIGHT
app.options("*", cors());

app.use(express.json());

/* =========================
   MERCADO PAGO
========================= */
if (!process.env.MP_ACCESS_TOKEN) {
  throw new Error("❌ MP_ACCESS_TOKEN no está definido");
}

const mp = new MercadoPago({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

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

    const preference = {
      items: [
        {
          title,
          quantity: 1,
          unit_price: Number(price),
          currency_id: "COP",
        },
      ],
      back_urls: {
        success: "https://profixa.netlify.app/success",
        failure: "https://profixa.netlify.app/failure",
        pending: "https://profixa.netlify.app/pending",
      },
      auto_return: "approved",
    };

    const response = await mp.preferences.create(preference);

    res.json({
      init_point: response.init_point,
    });
  } catch (error) {
    console.error("❌ Error Mercado Pago:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

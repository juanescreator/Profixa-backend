import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import MercadoPago from "mercadopago";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   CORS
========================= */
app.use(
  cors({
    origin: "https://profixa.netlify.app",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.options("*", cors());
app.use(express.json());

/* =========================
   MERCADO PAGO (CORRECTO)
========================= */
if (!process.env.MP_ACCESS_TOKEN) {
  throw new Error("MP_ACCESS_TOKEN no definido");
}

MercadoPago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

/* =========================
   HEALTH CHECK
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

    const response = await MercadoPago.preferences.create(preference);

    res.json({
      init_point: response.body.init_point,
    });
  } catch (error) {
    console.error("Error Mercado Pago:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference } from "mercadopago";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   MERCADO PAGO CONFIG
========================= */
if (!process.env.MP_ACCESS_TOKEN) {
  throw new Error("❌ MP_ACCESS_TOKEN no definido");
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const preferenceClient = new Preference(client);

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({
  origin: ["https://profixa.netlify.app"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

/* =========================
   HEALTH
========================= */
app.get("/", (req, res) => {
  res.json({ ok: true, service: "ProFixa backend running" });
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

    const response = await preferenceClient.create({
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
          success: "https://profixa.netlify.app/success",
          failure: "https://profixa.netlify.app/failure",
          pending: "https://profixa.netlify.app/pending"
        },
        auto_return: "approved"
      }
    });

    res.json({
      ok: true,
      init_point: response.init_point
    });

  } catch (error) {
    console.error("MP ERROR:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

app.listen(PORT, () => {
  console.log("🚀 ProFixa backend activo en puerto", PORT);
});

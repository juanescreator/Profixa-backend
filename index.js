import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference } from "mercadopago";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARES
========================= */
app.use(
  cors({
    origin: "https://profixa.netlify.app",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

/* =========================
   MERCADO PAGO CLIENT
========================= */
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "ProFixa Backend",
  });
});

/* =========================
   CREAR PREFERENCIA
========================= */
app.post("/crear-preferencia", async (req, res) => {
  try {
    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        error: "Datos incompletos",
      });
    }

    const preference = new Preference(mpClient);

    const response = await preference.create({
      body: {
        items: [
          {
            title: title,
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
      },
    });

    res.json({
      init_point: response.init_point,
    });
  } catch (error) {
    console.error("ERROR MERCADO PAGO:", error);
    res.status(500).json({
      error: "Error creando la preferencia",
    });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`ProFixa backend running on port ${PORT}`);
});

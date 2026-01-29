import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   CORS CONFIG
========================= */
app.use(
  cors({
    origin: [
      "https://profixa.netlify.app"
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json());

/* =========================
   HEALTH
========================= */
app.get("/", (req, res) => {
  res.json({ status: "OK ProFixa backend running" });
});

/* =========================
   TEST API
========================= */
app.get("/api/test", (req, res) => {
  res.json({ message: "API works" });
});

/* =========================
   RESERVA (SIMULADA)
========================= */
app.post("/crear-preferencia", async (req, res) => {
  try {
    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // simulamos checkout
    res.json({
      ok: true,
      message: "Reserva creada",
      fake_checkout_url: "https://www.mercadopago.com/checkout"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error reserva" });
  }
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

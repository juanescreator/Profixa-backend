import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   CORS — FIX DEFINITIVO
========================= */
app.use(cors({
  origin: "https://profixa.netlify.app",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// 👇 MUY IMPORTANTE
app.options("*", cors());

app.use(express.json());

/* =========================
   HEALTH
========================= */
app.get("/", (req, res) => {
  res.json({ status: "OK ProFixa backend running" });
});

/* =========================
   CREAR PREFERENCIA (SIMULADA O REAL)
========================= */
app.post("/crear-preferencia", async (req, res) => {
  try {
    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // ⚠️ aquí luego va Mercado Pago real
    res.json({
      init_point: "https://www.mercadopago.com/checkout"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno" });
  }
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});


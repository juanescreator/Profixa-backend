import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   CORS — SOLUCIÓN DEFINITIVA
========================= */
app.use(cors({
  origin: "https://profixa.netlify.app",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
}));

// 🔴 ESTO ES CLAVE (preflight)
app.options("*", cors());

app.use(express.json());

/* =========================
   HEALTH
========================= */
app.get("/", (req, res) => {
  res.json({ status: "OK ProFixa backend running" });
});

/* =========================
   CREAR PREFERENCIA (TEST)
========================= */
app.post("/crear-preferencia", async (req, res) => {
  try {
    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // RESPUESTA DE PRUEBA
    res.json({
      init_point: "https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=TEST"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("🚀 Backend running on port", PORT);
});

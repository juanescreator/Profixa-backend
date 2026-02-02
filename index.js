import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

/* 🔥 LOG DE VIDA */
console.log("🔥 BACKEND PROFIXA REAL EJECUTÁNDOSE");

/* 🔥 CORS FORZADO */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://profixa.netlify.app");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

/* HEALTH */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Backend ProFixa vivo" });
});

/* RESERVA */
app.post("/crear-preferencia", (req, res) => {
  const { title, price } = req.body;

  if (!title || !price) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  // simulación checkout (por ahora)
  res.json({
    init_point: "https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=TEST"
  });
});

app.listen(PORT, () => {
  console.log("🚀 Server listening on", PORT);
});


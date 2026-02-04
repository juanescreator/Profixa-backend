import express from "express";
import cors from "cors";
import MercadoPago from "mercadopago";

// ================================
// CONFIGURACIÓN BÁSICA
// ================================
const app = express();

// ================================
// CORS (CRÍTICO)
// ================================
app.use(cors({
  origin: "https://profixa.netlify.app",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Responder preflight
app.options("*", cors());

// ================================
// MIDDLEWARES
// ================================
app.use(express.json());

// ================================
// MERCADO PAGO
// ================================
const mp = new MercadoPago({
  accessToken: process.env.MP_ACCESS_TOKEN
});

// ================================
// RUTA DE PRUEBA
// ================================
app.get("/", (req, res) => {
  res.send("Backend ProFixa activo 🚀");
});

// ================================
// CREAR PREFERENCIA
// ================================
app.post("/crear-preferencia", async (req, res) => {
  try {
    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        error: "Faltan datos: title o price"
      });
    }

    const preference = {
      items: [
        {
          title: title,
          quantity: 1,
          unit_price: Number(price),
          currency_id: "COP"
        }
      ],
      back_urls: {
        success: "https://profixa.netlify.app/exito.html",
        failure: "https://profixa.netlify.app/error.html",
        pending: "https://profixa.netlify.app/pendiente.html"
      },
      auto_return: "approved"
    };

    const response = await mp.preferences.create(preference);

    res.json({
      init_point: response.body.init_point
    });

  } catch (error) {
    console.error("Error Mercado Pago:", error);
    res.status(500).json({
      error: "Error creando preferencia"
    });
  }
});

// ================================
// LISTEN (UNO SOLO)
// ================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor ProFixa corriendo en puerto", PORT);
});

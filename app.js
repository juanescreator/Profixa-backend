import express from "express";
import cors from "cors";
import mercadopago from "mercadopago";
import crypto from "crypto";
import dbPromise from "./db/database.js";
import { enviarWhatsApp } from "./services/whatsapp.js";

const cardsContainer = document.getElementById("cards");
const filtroCiudad = document.getElementById("filtroCiudad");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroPrecio = document.getElementById("filtroPrecio");
const filtroVerificado = document.getElementById("filtroVerificado");

function renderProfesionales(lista) {
  cardsContainer.innerHTML = "";

  if (lista.length === 0) {
    cardsContainer.innerHTML = "<p>No hay resultados</p>";
    return;
  }

  lista.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <h3>${p.nombre}</h3>
      <p><strong>Categoría:</strong> ${p.categoria}</p>
      <p><strong>Ciudad:</strong> ${p.ciudad}</p>
      <p><strong>Precio:</strong> $${p.precio.toLocaleString()}</p>
      <p>${p.verificado ? "✅ Verificado" : "❌ No verificado"}</p>
    `;

    cardsContainer.appendChild(card);
  });
}

function aplicarFiltros() {
  let resultado = [...profesionales];

  if (filtroCiudad.value) {
    resultado = resultado.filter(p => p.ciudad === filtroCiudad.value);
  }

  if (filtroCategoria.value) {
    resultado = resultado.filter(p => p.categoria === filtroCategoria.value);
  }

  if (filtroPrecio.value) {
    resultado = resultado.filter(p => p.precio <= Number(filtroPrecio.value));
  }

  if (filtroVerificado.checked) {
    resultado = resultado.filter(p => p.verificado);
  }

  renderProfesionales(resultado);
}

// Eventos
[filtroCiudad, filtroCategoria, filtroPrecio].forEach(f =>
  f.addEventListener("change", aplicarFiltros)
);

filtroVerificado.addEventListener("change", aplicarFiltros);

// Inicial
renderProfesionales(profesionales);

const app = express();

app.use(cors());
app.use(express.json());

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

/* ==============================
   CREAR PREFERENCIA DE PAGO
================================ */
app.post("/crear-preferencia", async (req, res) => {
  try {
    const {
      profesional,
      categoria,
      ciudad,
      precio,
      email_cliente,
      telefono_cliente
    } = req.body;

    const db = await dbPromise;

    const result = await db.run(
      `INSERT INTO reservas 
       (profesional, categoria, ciudad, precio, email_cliente, telefono_cliente)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [profesional, categoria, ciudad, precio, email_cliente, telefono_cliente]
    );

    const reservaId = result.lastID;

    const preference = {
      items: [
        {
          title: `Servicio ${categoria}`,
          quantity: 1,
          currency_id: "COP",
          unit_price: Number(precio)
        }
      ],
      external_reference: reservaId.toString(),
      notification_url: `${process.env.WEBHOOK_URL}/webhook`,
      back_urls: {
        success: "http://localhost:3000/success",
        failure: "http://localhost:3000/failure"
      },
      auto_return: "approved"
    };

    const response = await mercadopago.preferences.create(preference);

    res.json({
      init_point: response.body.init_point
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});
function validarFirmaWebhook(req) {
  const signature = req.headers["x-signature"];
  const requestId = req.headers["x-request-id"];

  if (!signature || !requestId) return false;

  const secret = process.env.MP_WEBHOOK_SECRET;

  const [tsPart, hashPart] = signature.split(",");
  const ts = tsPart.split("=")[1];
  const hash = hashPart.split("=")[1];

  const manifest = `id:${requestId};ts:${ts};`;

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return hmac === hash;
}
function notificarCliente(reserva) {
  const mensaje = `
✅ *Pago confirmado*

Tu servicio ha sido reservado correctamente.

👨‍🔧 Profesional: ${reserva.profesional}
📂 Categoría: ${reserva.categoria}
📍 Ciudad: ${reserva.ciudad}
💰 Precio: $${reserva.precio}

Gracias por usar ProFixa.
`;

  // ⚠️ aquí luego puedes guardar el teléfono del cliente en BD
  enviarWhatsApp("57NUMEROCLIENTE", mensaje);
}

function notificarProfesional(reserva) {
  const mensaje = `
📢 *Nuevo servicio confirmado*

Un cliente ha pagado por tu servicio.

👤 Cliente: pendiente
📂 Categoría: ${reserva.categoria}
📍 Ciudad: ${reserva.ciudad}
💰 Valor: $${reserva.precio}

Ingresa al panel para más detalles.
`;

  enviarWhatsApp("57NUMEROPROFESIONAL", mensaje);
}

/* ==============================
   WEBHOOK PRODUCTIVO
================================ */
app.post("/webhook", async (req, res) => {
  try {
    const firmaValida = validarFirmaWebhook(req);

    if (!firmaValida) {
      console.log("❌ Webhook rechazado: firma inválida");
      return res.sendStatus(401);
    }

    const { type, data } = req.body;

    if (type !== "payment") return res.sendStatus(200);

    const paymentId = data.id;
    const payment = await mercadopago.payment.findById(paymentId);

    if (payment.body.status !== "approved") {
      return res.sendStatus(200);
    }

    const reservaId = payment.body.external_reference;
    const db = await dbPromise;

    const reserva = await db.get(
      "SELECT * FROM reservas WHERE id = ?",
      [reservaId]
    );

    if (!reserva) return res.sendStatus(200);
    if (reserva.estado === "pagado") return res.sendStatus(200);

    await db.run(
      `UPDATE reservas 
       SET estado = 'pagado', mp_payment_id = ?, notificado = 1
       WHERE id = ?`,
      [paymentId, reservaId]
    );

    console.log("✅ Pago confirmado vía webhook seguro:", reservaId);

    notificarCliente(reserva);
    notificarProfesional(reserva);

    res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
});


/* ==============================
   NOTIFICACIONES (BASE)
================================ */
function notificarCliente(reserva) {
  console.log(`
📩 Cliente notificado
Reserva #${reserva.id}
Servicio: ${reserva.categoria}
Estado: PAGADO
`);
}

function notificarProfesional(reserva) {
  console.log(`
👷 Profesional notificado
Nueva reserva confirmada
Reserva #${reserva.id}
`);
}
app.get("/reservas", async (req, res) => {
  const db = await dbPromise;
  const reservas = await db.all("SELECT * FROM reservas ORDER BY id DESC");
  res.json(reservas);
});

export default app;

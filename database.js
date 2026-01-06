import sqlite3 from "sqlite3";
import { open } from "sqlite";

const dbPromise = open({
  filename: "./db/profixa.db",
  driver: sqlite3.Database
});

(async () => {
  const db = await dbPromise;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profesional TEXT,
      categoria TEXT,
      ciudad TEXT,
      precio REAL,
      estado TEXT DEFAULT 'pendiente',
      mp_payment_id TEXT,
      email_cliente TEXT,
      telefono_cliente TEXT,
      notificado INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Base de datos lista");
})();

export default dbPromise;


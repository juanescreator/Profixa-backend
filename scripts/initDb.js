import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath =
  process.env.NODE_ENV === "production"
    ? "/tmp/profixa.db"
    : path.join(__dirname, "../db/profixa.db");

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      password TEXT NOT帮助
    )
  `);

  db.get(`SELECT COUNT(*) as count FROM admins`, (err, row) => {
    if (err) {
      console.error("Error checking admin table:", err);
      return;
    }

    if (row.count === 0) {
      import("bcrypt").then(({ default: bcrypt }) => {
        const hashed = bcrypt.hashSync("admin123", 10);

        db.run(
          `INSERT INTO admins (password) VALUES (?)`,
          [hashed],
          () => console.log("✅ Admin creado por defecto")
        );
      });
    }
  });
});

export default db;

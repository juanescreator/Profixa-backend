import sqlite3 from "sqlite3";
import { open } from "sqlite";
import bcrypt from "bcryptjs";

(async () => {
  const db = await open({
    filename: "./db/profixa.db",
    driver: sqlite3.Database,
  });

  const email = "admin@profixa.com";
  const passwordPlano = "admin123";

  const hash = await bcrypt.hash(passwordPlano, 10);

  await db.run(
    "INSERT INTO admins (email, password) VALUES (?, ?)",
    [email, hash]
  );

  console.log("✅ Admin creado correctamente");
})();

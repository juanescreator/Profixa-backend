import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

/* =========================
   VALIDACIONES DE ARRANQUE
========================= */
if (!process.env.ADMIN_PASSWORD) {
  throw new Error("❌ ADMIN_PASSWORD no está definida");
}

if (!process.env.JWT_SECRET) {
  throw new Error("❌ JWT_SECRET no está definida");
}

/* =========================
   HASH DEL PASSWORD (UNA VEZ)
========================= */
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(
  process.env.ADMIN_PASSWORD,
  10
);

/* =========================
   LOGIN ADMIN
========================= */
router.post("/login", async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password requerida" });
  }

  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

  if (!ok) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const token = jwt.sign(
    { admin: true },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token });
});

export default router;

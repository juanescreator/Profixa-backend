import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* Health route */
app.get("/", (req, res) => {
  res.json({ status: "OK ProFixa backend running" });
});

/* Test API */
app.get("/api/test", (req, res) => {
  res.json({ message: "API works" });
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

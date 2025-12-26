import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const target =
  process.env.CAMERA_BASE_URL ||
  process.env.VITE_CAMERA_BASE_URL ||
  "http://127.0.0.1:3001";
const port = Number(process.env.PORT || 4173);

const proxyOptions = {
  target,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  proxyTimeout: 0,
  timeout: 0,
};

app.use("/api", createProxyMiddleware(proxyOptions));
app.use("/uploads", createProxyMiddleware(proxyOptions));

app.use(express.static(path.join(__dirname, "dist"), { extensions: ["html"] }));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`pi_web listening on http://localhost:${port} (proxy -> ${target})`);
});

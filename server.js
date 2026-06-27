import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const distDir = process.env.FRONT_DIST_DIR || path.join(__dirname, "dist");

const cameraTarget =
  process.env.CAMERA_BASE_URL ||
  process.env.VITE_CAMERA_BASE_URL ||
  "http://127.0.0.1:3001";
const backTarget =
  process.env.BACK_BASE_URL ||
  process.env.VITE_BACK_BASE_URL ||
  process.env.VITE_API_BASE ||
  "http://127.0.0.1:3000";
const port = Number(process.env.PORT || 4173);

const createProxyOptions = (target) => ({
  target,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  proxyTimeout: 0,
  timeout: 0,
});

app.use("/api/camera", createProxyMiddleware(createProxyOptions(cameraTarget)));
app.use("/api/session", createProxyMiddleware(createProxyOptions(cameraTarget)));
app.use("/api", createProxyMiddleware(createProxyOptions(backTarget)));
app.use("/uploads", createProxyMiddleware(createProxyOptions(backTarget)));

app.use(express.static(distDir, { extensions: ["html"] }));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `pi_web listening on http://localhost:${port} (api -> ${backTarget}, camera -> ${cameraTarget})`
  );
});

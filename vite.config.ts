import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const cameraBase =
    env.VITE_CAMERA_BASE_URL ||
    env.VITE_CAMERA_API_BASE ||
    env.NEXT_PUBLIC_CAMERA_API_BASE ||
    "http://127.0.0.1:3001";
  const backBase =
    env.VITE_BACK_BASE_URL ||
    env.VITE_API_BASE ||
    env.VITE_BACK_BASE_URL_LOCAL ||
    env.VITE_BACK_BASE_URL_PI ||
    "http://127.0.0.1:3000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api/camera": {
          target: cameraBase,
          changeOrigin: true,
        },
        "/api/session": {
          target: cameraBase,
          changeOrigin: true,
        },
        "/uploads": {
          target: cameraBase,
          changeOrigin: true,
        },
        "/api": {
          target: backBase,
          changeOrigin: true,
        },
      },
    },
  };
});

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || env.API_PROXY_TARGET || "http://api:8000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/vision": {
          target: env.VITE_VISION_PROXY_TARGET || env.VISION_PROXY_TARGET || "http://vision-service:8001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/vision/, ""),
        },
        "/packing": {
          target: env.VITE_PACKING_PROXY_TARGET || env.PACKING_PROXY_TARGET || "http://packing-service:8002",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/packing/, ""),
        },
      },
    },
  };
});

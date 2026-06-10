import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_BASE_URL?.trim() || `http://localhost:${env.PORT || "8787"}`;

  return {
    plugins: [react()],
    test: {
      exclude: ["**/node_modules/**", "**/dist/**", "**/server-dist/**"]
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            charts: ["recharts"],
            motion: ["framer-motion"],
            icons: ["lucide-react"]
          }
        }
      }
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["stand-genesis-meals-ant.trycloudflare.com"],
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true
        }
      }
    }
  };
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, run the API server on :8080 and this Vite server on :5173.
// Requests to /api and /health are proxied to the backend so the SPA can use
// same-origin relative URLs in both dev and production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
  build: {
    outDir: "dist",
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "star_byte",
        short_name: "starbyte",
        description: "Private IRC-based community chat",
        theme_color: "#0b1020",
        background_color: "#0b1020",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
        ? {
          protocol: "ws",
          host,
          port: 1421
        }
        : undefined,
    watch: {
      ignored: ["**/src-tauri/**"]
    },
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": {
        target: "ws://localhost:3001",
        ws: true
      },
      "/health": "http://localhost:3001"
    },
    allowedHosts: true
  }
});

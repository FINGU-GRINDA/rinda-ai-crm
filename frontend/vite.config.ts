import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "")
  return {
    base: "/",
    server: {
      port: 3000,
      host: true,
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), tailwindcss()],
    // API 키 노출 제거 - 백엔드에서 관리
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  }
})

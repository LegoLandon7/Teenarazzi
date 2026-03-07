import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
const enableCloudflareVite = process.env.ENABLE_CLOUDFLARE_VITE === "1";

export default defineConfig({
  base: "/",
  cacheDir: ".vite",
  plugins: enableCloudflareVite ? [react(), cloudflare()] : [react()],
  server: {
    host: true
  }
})

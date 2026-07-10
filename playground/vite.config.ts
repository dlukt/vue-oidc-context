import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// Fixed port: the IdP-side redirect URIs (Keycloak realm import, .env.local
// recipes in README.md) assume http://localhost:5173.
export default defineConfig({
  plugins: [vue()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});

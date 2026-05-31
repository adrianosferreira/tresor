import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@tresor/crypto": path.resolve(root, "../../packages/crypto/src/index.ts"),
      "@tresor/shared": path.resolve(root, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});

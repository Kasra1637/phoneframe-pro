import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), cloudflare()],
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
  },
});
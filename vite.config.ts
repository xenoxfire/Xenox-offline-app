import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    cssMinify: true,
    target: "es2020",
    assetsInlineLimit: 100000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/@tanstack") || id.includes("node_modules/wouter")) return "vendor";
          if (id.includes("node_modules/xlsx")) return "sheet-export";
          if (id.includes("node_modules/@radix-ui") || id.includes("node_modules/lucide-react")) return "ui";
        },
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // React core + routing + scheduler
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }
          // Radix UI primitives
          if (id.includes("/@radix-ui/")) {
            return "vendor-radix";
          }
          // Framer Motion + Motion One internals
          if (id.includes("/framer-motion/") || id.includes("/@motionone/")) {
            return "vendor-motion";
          }
          // Supabase client
          if (id.includes("/@supabase/")) {
            return "vendor-supabase";
          }
        },
      },
    },
  },
}));

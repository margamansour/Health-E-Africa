import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// `--mode offline` builds everything into one bundle with fonts and images inlined,
// so it can be turned into a single HTML file that runs without a connection.
export default defineConfig(({ mode }) => {
  const offline = mode === "offline";
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    build: offline
      ? {
          outDir: "dist-offline",
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
          modulePreload: false,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : {},
  };
});

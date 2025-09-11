import { build } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

async function buildClient() {
  console.log("Building client without Replit dependencies...");
  
  // Inline Vite config without Replit dependencies
  const standaloneConfig = {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "..", "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "..", "shared"),
        "@assets": path.resolve(import.meta.dirname, "..", "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "..", "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "..", "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    configFile: false as const,
  };

  try {
    await build(standaloneConfig);
    console.log("Client build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

buildClient();
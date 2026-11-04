import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT ?? 5173);
  const target = env.VITE_API_PROXY_TARGET ?? `http://localhost:${env.PORT ?? 3001}`;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": new URL("./src", import.meta.url).pathname },
    },
    server: {
      port,
      proxy: { "/api": { target, changeOrigin: true } },
    },
  };
});

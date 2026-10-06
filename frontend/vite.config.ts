import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** The API URL is baked into the bundle at build time: warn when a build would ship without it. */
function warnMissingApiUrl(): Plugin {
  return {
    name: "movieverse:warn-missing-api-url",
    configResolved(config) {
      if (config.command === "build" && !config.env.VITE_API_URL) {
        config.logger.warn("\n⚠ VITE_API_URL is not set: the build will call /api/v1 on its own origin.\n");
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), warnMissingApiUrl()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5173 },
});

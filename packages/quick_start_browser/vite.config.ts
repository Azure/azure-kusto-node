import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        "process.env": {},
    },
    // Used for local builds to force refresh links to the local version
    optimizeDeps: {
        include: ['azure-kusto-data', 'azure-kusto-ingest'],
        force:true
      },
    build: {
        rollupOptions: {
          external: ['azure-kusto-data', 'azure-kusto-ingest']
        }
      },
    server: {
        // The port must match the configured redirectUri in the Azure portal app
        port:   3000
    }
});

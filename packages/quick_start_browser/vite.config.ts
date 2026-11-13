// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        "process.env": {},
    },
    optimizeDeps: {
        include: ["azure-kusto-data", "azure-kusto-ingest"],
        force: true,
    },
    server: {
        // The port must match the configured redirectUri in the Azure portal app
        port: 3000,
    },
});

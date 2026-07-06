import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { "@": resolve(root, "src") },
    },
    server: {
        proxy: {
            "/api": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/api/, ""); },
            },
        },
    },
});

import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  base: "/code-playground/",
  build: {
    rollupOptions: {
      input: {
        home: resolve("index.html"),
        color: resolve("oklch-explorer/index.html"),
      },
    },
  },
});

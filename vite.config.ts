import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "node:path";
import process from "node:process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

const host = process.env.TAURI_DEV_HOST;
const cesium = path.resolve("node_modules/cesium/Build/Cesium").replace(/\\/g, "/");

export default defineConfig(() => ({
  base: "./",
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: `${cesium}/Workers`, dest: "cesium" },
        { src: `${cesium}/ThirdParty`, dest: "cesium" },
        { src: `${cesium}/Assets`, dest: "cesium" },
        { src: `${cesium}/Widgets`, dest: "cesium" },
      ],
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify("./cesium/"),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));

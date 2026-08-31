import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "cesium", "Build", "Cesium");
const dst = join(root, "public", "cesium");

if (!existsSync(join(src, "Workers"))) {
  console.warn("Cesium build assets missing; skip copy");
  process.exit(0);
}

mkdirSync(dst, { recursive: true });
for (const name of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  cpSync(join(src, name), join(dst, name), { recursive: true });
}
console.log("Copied Cesium static assets to public/cesium");

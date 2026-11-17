// Copies MapLibre's web worker into public/ so the map works under any bundler and is served from our own origin
// (no CDN, no third party). Runs before dev/build; also commit the result so a plain `next dev` works.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const to = resolve(root, "public/vendor/maplibre/maplibre-gl-worker.mjs");
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log("Synced maplibre-gl-worker.mjs to public/vendor/maplibre/");

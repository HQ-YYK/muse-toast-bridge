import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";

export default defineConfig({
  // base "./" makes Vite emit relative asset URLs (e.g. "./assets/...")
  // instead of root-absolute "/assets/...". Root-absolute URLs break inside
  // a chrome-extension:// popup/options page (they'd resolve to the extension
  // root, not next to the html), which is why the popup button wouldn't open.
  base: "./",
  plugins: [crx({ manifest })],
  build: {
    target: "es2022",
    outDir: "dist",
  },
});

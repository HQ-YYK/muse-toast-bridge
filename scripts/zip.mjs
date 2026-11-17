// Build a distributable .zip of the dist/ folder.
// Used by `npm run build:zip`. Relies only on Node built-ins.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdirSync } from "node:fs";

const pkg = JSON.parse(
  await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ),
);

const name = `${pkg.name}-v${pkg.version}.zip`;

// On Windows, PowerShell's Compress-Archive is always available.
if (process.platform === "win32") {
  if (!existsSync("dist")) {
    console.error("dist/ not found — run `npm run build` first.");
    process.exit(1);
  }
  mkdirSync("release", { recursive: true });
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path 'dist\\*' -DestinationPath 'release\\${name}' -Force"`,
    { stdio: "inherit" },
  );
  console.log(`Wrote release/${name}`);
} else {
  // POSIX fallback: zip -r
  execSync(`cd dist && zip -r ../release/${name} .`, { stdio: "inherit" });
  console.log(`Wrote release/${name}`);
}

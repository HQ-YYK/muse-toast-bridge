// Build a distributable .crx + updates.xml for private auto-update via
// GitHub Releases. Used by `npm run release`.
//
// Flow:
//   1. (optional) bump version via --bump <major|minor|patch>
//   2. build the extension (dist/)
//   3. generate a .pem signing key if one doesn't exist (kept OUT of git)
//   4. package dist/ into a CRX3-signed .crx using Chrome/Edge's
//      `--pack-extension`
//   5. emit updates.xml pointing at the GitHub Release asset URL
//
// The .crx + updates.xml are meant to be uploaded as GitHub Release assets.
// Chrome polls `update_url` (in the manifest) every few hours and applies the
// update when the xml's version is newer than the installed one.

import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

// ---- parse args ----------------------------------------------------------
const args = process.argv.slice(2);
const bumpIdx = args.indexOf("--bump");
const bump = bumpIdx >= 0 ? args[bumpIdx + 1] : null;
if (bump && !["major", "minor", "patch"].includes(bump)) {
  console.error(`Unknown --bump value "${bump}" (use major|minor|patch).`);
  process.exit(1);
}

// ---- locate Chrome/Edge for --pack-extension -----------------------------
function findBrowser() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

const browser = findBrowser();
if (!browser) {
  console.error("Could not locate Chrome/Edge to sign the CRX. Aborting.");
  process.exit(1);
}
console.log(`Using browser for signing: ${browser}`);

// ---- version bump --------------------------------------------------------
let version = pkg.version;
if (bump) {
  const [maj, min, pat] = version.split(".").map(Number);
  const next =
    bump === "major" ? [maj + 1, 0, 0] :
    bump === "minor" ? [maj, min + 1, 0] :
    [maj, min, pat + 1];
  version = next.join(".");
  pkg.version = version;
  writeFileSync(path.join(root, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  console.log(`Bumped version -> ${version}`);
}

// ---- build ---------------------------------------------------------------
console.log("Building extension…");
execSync("npm run build", { cwd: root, stdio: "inherit" });

// ---- signing key ---------------------------------------------------------
const pemPath = path.join(root, "key.pem");
if (!existsSync(pemPath)) {
  console.log("Generating signing key (key.pem)…");
  // Reuse Chrome to generate a key is not directly exposed; instead we rely
  // on --pack-extension to generate one for us (it creates <name>.pem next to
  // the .crx when no --pack-extension-key is given). We'll detect that below.
}

const releaseDir = path.join(root, "release");
mkdirSync(releaseDir, { recursive: true });

const crxName = `${pkg.name}-v${version}.crx`;
const crxPath = path.join(releaseDir, crxName);

// ---- pack extension (CRX3, signed) --------------------------------------
// Chrome/Edge's --pack-extension signs with a freshly generated key on first
// run, producing a sibling <dir>.pem we keep for future updates so the CRX
// id stays stable (required for auto-update).
const distDir = path.join(root, "dist");
const packArgs = [
  `--pack-extension=${distDir}`,
  `--pack-extension-key=${pemPath}`,
  "--no-message-box",
];

try {
  execFileSync(browser, packArgs, { stdio: "inherit" });
} catch {
  // First run: key.pem may not exist yet. Chrome can generate it if we omit
  // the key flag, but then the id is derived from the generated key. Generate
  // the key first via a one-off pack without --pack-extension-key.
  if (!existsSync(pemPath)) {
    console.log("No key.pem — generating one via Chrome…");
    execFileSync(browser, [`--pack-extension=${distDir}`, "--no-message-box"], {
      stdio: "inherit",
    });
    // Chrome writes dist.pem next to dist/ -> dist/../dist.pem
    const generatedPem = path.join(root, "dist.pem");
    if (existsSync(generatedPem)) {
      copyFileSync(generatedPem, pemPath);
      console.log(`Saved signing key -> key.pem`);
    }
    // Repack with the key to produce a deterministic id + sign.
    execFileSync(browser, [
      `--pack-extension=${distDir}`,
      `--pack-extension-key=${pemPath}`,
      "--no-message-box",
    ], { stdio: "inherit" });
  } else {
    throw new Error("Pack failed and no key.pem present.");
  }
}

// Chrome emits dist.crx next to dist/; move it into release/.
const producedCrx = path.join(root, "dist.crx");
if (!existsSync(producedCrx)) {
  console.error(`Expected ${producedCrx} but not found.`);
  process.exit(1);
}
if (existsSync(crxPath)) {
  // remove stale copy
  try { require("node:fs").rmSync(crxPath); } catch {}
}
copyFileSync(producedCrx, crxPath);
try { require("node:fs").rmSync(producedCrx); } catch {}

const crxSize = statSync(crxPath).size;

// ---- compute codebase sha256 (needed by updates.xml) ---------------------
const crxHash = createHash("sha256").update(readFileSync(crxPath)).digest("hex");

// ---- CRX appid (must match the installed extension's id) -----------------
// The extension id is the first 128 bits of sha256(pubkey-spki), base32-encoded.
const { createPublicKey } = await import("node:crypto");
const spkiDer = createPublicKey(readFileSync(pemPath, "utf8")).export({
  type: "spki",
  format: "der",
});
const idHash = createHash("sha256").update(spkiDer).digest();
const ABC = "abcdefghijklmnopqrstuvwxyz0123456789";
let appid = "";
for (let i = 0; i < 16; i++) {
  appid += ABC[idHash[i] >> 3];
  appid += ABC[((idHash[i] & 7) << 2) | (idHash[i + 1] >> 6)];
}

// ---- updates.xml ---------------------------------------------------------
// Asset URL on GitHub Releases. Tag name must equal "v<version>".
const repo = "HQ-YYK/muse-toast-bridge";
const assetUrl = `https://github.com/${repo}/releases/download/v${version}/${crxName}`;

const xml = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">`,
  `  <app appid="${appid}">`,
  `    <updatecheck codebase="${assetUrl}" version="${version}" />`,
  `  </app>`,
  `</gupdate>`,
].join("\n") + "\n";

// Write updates.xml BOTH into release/ (for the Release asset) and into the
// repo root (committed to main, so the raw URL in the manifest stays valid).
writeFileSync(path.join(releaseDir, "updates.xml"), xml);
writeFileSync(path.join(root, "updates.xml"), xml);

console.log("\n=== release artifacts ===");
console.log(`  ${crxPath}  (${crxSize} bytes)`);
console.log(`  ${path.join(root, "updates.xml")}  (commit this to main)`);
console.log(`  sha256: ${crxHash}`);
console.log(`\nNext steps:`);
console.log(`  1. git add updates.xml && git commit -m "v${version}"`);
console.log(`  2. git tag v${version} && git push && git push --tags`);
console.log(`  3. Create a GitHub Release for tag v${version}, attach ${crxName}.`);
console.log(`  4. Install ${crxName} once (drag into chrome://extensions).`);
console.log(`     Chrome auto-updates from main/updates.xml thereafter.`);

// Builds the whole app into ONE self-contained HTML file (code, styles, fonts, icon inlined).
// It works without a connection and can be hosted anywhere or opened from a phone's files.
// Usage: npm run build:offline  →  dist-offline/health-e-africa-demo.html
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "dist-offline";
execSync("npx vite build --mode offline --base ./", { stdio: "inherit", env: { ...process.env, VITE_HASH_ROUTER: "1" } });

const assets = readdirSync(join(dir, "assets"));
const js = readFileSync(join(dir, "assets", assets.find((f) => f.endsWith(".js"))), "utf8").replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(dir, "assets", assets.find((f) => f.endsWith(".css"))), "utf8");
const icon = `data:image/svg+xml;base64,${readFileSync(join(dir, "icon.svg")).toString("base64")}`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#f7f2ea" />
<meta name="description" content="Health-e Africa demo: a patient-held health passport. Sample data only; everything stays on this device." />
<link rel="icon" href="${icon}" />
<link rel="apple-touch-icon" href="${icon}" />
<title>Health-e Africa</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${js}</script>
</body>
</html>
`;
const out = join(dir, "health-e-africa-demo.html");
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);

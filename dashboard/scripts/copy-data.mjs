import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.join(__dirname, "..");
const srcDir = path.join(dashboardRoot, "..", "assessment-fallback-data");
const destDir = path.join(dashboardRoot, "public", "data");

if (!fs.existsSync(srcDir)) {
  console.warn("assessment-fallback-data not found at", srcDir);
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
for (const f of fs.readdirSync(srcDir).filter((x) => x.endsWith(".json"))) {
  fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
}
console.log("Trip JSON copied to public/data");

/**
 * Metro — Generate Audio (edge-tts)
 *
 * Usage: npx tsx scripts/generate-audio.mts [id1] [id2] ...
 *
 * Reads scripts from Metro/routes.json, generates audio to Metro/public/
 */

import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

interface RouteEntry {
  id: number;
  route?: string;
  script: string;
  audioFile?: string;
}

// Load routes.json
const routesPath = path.join(ROOT, "routes.json");
const allRoutes: RouteEntry[] = JSON.parse(fs.readFileSync(routesPath, "utf-8"));

// Filter by CLI args
const argIds = process.argv.slice(2).map(Number).filter(Boolean);
const routes = argIds.length > 0
  ? allRoutes.filter((r) => argIds.includes(r.id))
  : allRoutes;

if (routes.length === 0) {
  console.error("No routes found to process.");
  process.exit(1);
}

const EDGE_VOICE = "en-US-GuyNeural";

function stripSSMLTags(text: string): string {
  return text.replace(/<break\s+time=["'][^"']+["']\s*\/?>/gi, "").replace(/\s{2,}/g, " ").trim();
}

async function generateWithEdgeTts(text: string, outWav: string) {
  const tempMp3 = outWav.replace(/\.wav$/i, ".tmp.mp3");
  const tempTxt = outWav.replace(/\.wav$/i, ".tmp.txt");
  const cleanText = stripSSMLTags(text);
  fs.writeFileSync(tempTxt, cleanText, "utf-8");
  const res = spawnSync(
    "python3",
    ["-m", "edge_tts", "--voice", EDGE_VOICE, "--rate=+15%", "--file", tempTxt, "--write-media", tempMp3],
    { stdio: "pipe", shell: process.platform === "win32" },
  );
  fs.unlinkSync(tempTxt);
  if (res.status !== 0) {
    throw new Error(`edge-tts failed (exit ${res.status}): ${res.stderr?.toString() ?? ""}`);
  }
  execSync(`ffmpeg -i "${tempMp3}" "${outWav}" -y`, { stdio: "pipe" });
  fs.unlinkSync(tempMp3);
}

fs.mkdirSync(PUBLIC, { recursive: true });

console.log(`\nUsing edge-tts (Guy) — ${routes.length} route(s)\n`);

for (const route of routes) {
  const audioFile = route.audioFile || `route-${route.id}-audio.wav`;
  const audioPath = path.join(PUBLIC, audioFile);
  process.stdout.write(`  Route ${route.id}: ${route.route || `Route ${route.id}`}... `);
  try {
    await generateWithEdgeTts(route.script, audioPath);
    console.log(`done -> public/${audioFile}`);
  } catch (err) {
    console.log("FAILED");
    console.error(`  ${err}`);
    process.exit(1);
  }
}

console.log("\nAll audio generated.");
console.log("\nNext steps:");
console.log("  1. Export TravelAnimator video");
console.log("  2. Place as public/route-<id>-video.mp4");
console.log("  3. Run render from parent project");
console.log();

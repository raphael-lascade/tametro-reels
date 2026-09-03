/**
 * TMETRO — Render All Routes
 *
 * Usage: npx tsx scripts/render-all.mts [id1] [id2] ...
 *
 * For each route:
 *   1. Transcribes audio with Whisper -> captions.json
 *   2. Speed-adjusts video to match audio duration
 *   3. Extracts hook clip (last 3s of export)
 *   4. Renders MetroOverview composition -> out/
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "out");
const WHISPER_PATH = path.join(ROOT, "whisper.cpp");
const FPS = 30;

interface RouteEntry {
  id: number;
  route?: string;
  script?: string;
  audioFile?: string;
  videoFile?: string;
  sfxFile?: string;
  captionStyle?: number;
}

// Load routes.json
const routesPath = path.join(ROOT, "routes.json");
const allRoutes: RouteEntry[] = JSON.parse(fs.readFileSync(routesPath, "utf-8"));

const argIds = process.argv.slice(2).map(Number).filter(Boolean);
const routes = argIds.length > 0
  ? allRoutes.filter((r) => argIds.includes(r.id))
  : allRoutes;

if (routes.length === 0) {
  console.error("No routes found.");
  process.exit(1);
}

// --- Helpers ---
function getMediaDuration(filePath: string): number {
  const result = execSync(
    `ffprobe -v error -select_streams a:0 -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
    { stdio: "pipe" }
  ).toString().trim();
  const dur = parseFloat(result);
  if (!isNaN(dur) && dur > 0) return dur;
  const result2 = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
    { stdio: "pipe" }
  ).toString().trim();
  return parseFloat(result2);
}

function getSafeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
}

function adjustVideoSpeed(videoPath: string, audioDuration: number, outputPath: string): void {
  const videoDuration = getMediaDuration(videoPath);
  const ptsFactor = audioDuration / videoDuration;
  console.log(`    Video: ${videoDuration.toFixed(2)}s -> ${audioDuration.toFixed(2)}s (pts=${ptsFactor.toFixed(4)})`);
  execSync(
    `ffmpeg -i "${videoPath}" -filter:v "setpts=${ptsFactor}*PTS" -an -c:v libx264 -preset fast -crf 18 -y "${outputPath}"`,
    { stdio: "pipe" }
  );
}

async function transcribeAudio(audioPath: string, captionsPath: string): Promise<void> {
  let whisperInputPath = audioPath;
  let tempFile: string | null = null;
  try {
    tempFile = audioPath.replace(/\.\w+$/, "-16k.wav");
    execSync(`ffmpeg -i "${audioPath}" -ar 16000 -ac 1 "${tempFile}" -y`, { stdio: "pipe" });
    whisperInputPath = tempFile;
    console.log("  Resampled audio to 16kHz mono");
  } catch {
    console.warn("  ffmpeg resample failed -- using original");
  }
  console.log("  Transcribing...");
  const whisperOutput = await transcribe({
    model: "medium.en",
    whisperPath: WHISPER_PATH,
    whisperCppVersion: "1.5.5",
    inputPath: whisperInputPath,
    tokenLevelTimestamps: true,
  });
  if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  const { captions } = toCaptions({ whisperCppOutput: whisperOutput });
  fs.writeFileSync(captionsPath, JSON.stringify(captions, null, 2));
  console.log(`  Captions written (${captions.length} entries)`);
}

// ============================================================
// MAIN
// ============================================================

// Validate files
console.log("\nValidating files...");
let missingFiles = false;
for (const route of routes) {
  const audioFile = route.audioFile || `route-${route.id}-audio.wav`;
  if (!fs.existsSync(path.join(PUBLIC, audioFile))) {
    console.error(`  Route ${route.id}: Missing public/${audioFile}`);
    missingFiles = true;
  }
  const videoFile = route.videoFile || `route-${route.id}-video.mp4`;
  if (!fs.existsSync(path.join(PUBLIC, videoFile))) {
    console.error(`  Route ${route.id}: Missing public/${videoFile}`);
    missingFiles = true;
  }
}
if (missingFiles) process.exit(1);
console.log("  All files present.\n");

// Set up Whisper
console.log("Setting up Whisper...");
await installWhisperCpp({ to: WHISPER_PATH, version: "1.5.5" });
await downloadWhisperModel({ model: "medium.en", folder: WHISPER_PATH });
console.log("Whisper ready.\n");

fs.mkdirSync(OUT, { recursive: true });

const tempFiles: string[] = [];

for (const route of routes) {
  const title = route.route || `Route ${route.id}`;
  const safeTitle = getSafeFilename(title);

  console.log(`${"=".repeat(62)}`);
  console.log(`  Route ${route.id}: ${title} [TMETRO]`);
  console.log(`${"=".repeat(62)}`);

  const audioFile = route.audioFile || `route-${route.id}-audio.wav`;
  const videoFile = route.videoFile || `route-${route.id}-video.mp4`;
  const captionsFileName = `route-${route.id}-captions.json`;

  // Transcribe
  const audioPath = path.join(PUBLIC, audioFile);
  const captionsPath = path.join(PUBLIC, captionsFileName);
  await transcribeAudio(audioPath, captionsPath);

  const audioDuration = getMediaDuration(audioPath);
  const mainDurationInFrames = Math.ceil(audioDuration * FPS);

  // Speed-adjust video
  const videoPath = path.join(PUBLIC, videoFile);
  const adjFile = `route-${route.id}-video-adjusted.mp4`;
  const adjPath = path.join(PUBLIC, adjFile);
  console.log("  Adjusting video speed...");
  adjustVideoSpeed(videoPath, audioDuration, adjPath);
  tempFiles.push(adjPath);

  // Extract hook clip (last 3s = zoom-out overview)
  const hookFile = `route-${route.id}-hook.mp4`;
  const hookPath = path.join(PUBLIC, hookFile);
  console.log("  Extracting hook clip (last 3s)...");
  try {
    execSync(
      `ffmpeg -sseof -3 -i "${videoPath}" -c:v libx264 -preset fast -crf 18 -an -y "${hookPath}"`,
      { stdio: "pipe" }
    );
    tempFiles.push(hookPath);
  } catch {
    console.log("    Hook extraction failed, using full video as hook");
    fs.copyFileSync(videoPath, hookPath);
    tempFiles.push(hookPath);
  }

  // Build props
  const props = {
    videoFile: adjFile,
    hookVideoFile: hookFile,
    audioFile,
    captionsFile: captionsFileName,
    logoFile: "logo.png",
    outroFile: "ta-outro.mp4",
    sfxFile: route.sfxFile || "train-voice.mp3",
    routeTitle: title,
    mainDurationInFrames,
    outroDurationInFrames: 150,
    videoPlaybackRate: 1,
  };

  // Render
  const outputFile = path.join(OUT, `route-${route.id}-${safeTitle}.mp4`);
  const propsFile = path.join(ROOT, `props-route-${route.id}.json`);
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));

  console.log(`  Rendering MetroOverview -> ${path.basename(outputFile)}`);
  const renderCmd = [
    "npx remotion render",
    "MetroOverview",
    `"${outputFile}"`,
    `--props="${propsFile}"`,
    "--gl=angle",
    "--concurrency=1",
    "--timeout=120000",
  ].join(" ");

  try {
    execSync(renderCmd, { stdio: "inherit", cwd: ROOT });
    console.log(`  Done: ${path.basename(outputFile)}\n`);
  } catch (err) {
    console.error(`  Render failed for Route ${route.id}:`, err);
  } finally {
    if (fs.existsSync(propsFile)) fs.unlinkSync(propsFile);
  }
}

// Cleanup temp files
for (const f of tempFiles) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

console.log("=".repeat(62));
console.log(`  ALL ${routes.length} TMETRO VIDEOS RENDERED`);
console.log("=".repeat(62));
console.log("\nOutput files:");
for (const route of routes) {
  const safeTitle = getSafeFilename(route.route || `Route ${route.id}`);
  console.log(`  out/route-${route.id}-${safeTitle}.mp4`);
}
console.log();

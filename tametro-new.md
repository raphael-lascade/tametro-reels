---
name: tametro-new
description: Guide user step-by-step through creating a new TMETRO reel (city metro overview)
user-invocable: true
---

# /tametro-new — Create a New TMETRO Reel

Walk the user through each step interactively. Do NOT skip steps or batch multiple steps. Wait for user input/approval at each checkpoint.

## Step 1: Pick City

Show available cities from `data/metro-systems.json` (or `Metro/data/metro-systems.json`). Ask user to pick one, or suggest the strongest unused cities. Check `Metro/routes.json` to see which cities are already done — don't suggest duplicates.

Present top 5 suggestions with their hook strength, then ask:
> "Which city? Pick from above or name any of the 61."

## Step 2: Show Research Data + Write Script

Pull the city's data from metro-systems.json. Display the key facts:
- Fare, day pass, network stats, card tip, special fact, ratings

Write the script following TMETRO template:
```
HOOK (2s) → DISTANCE (3s) → ORIGIN (4s) → FARE (4s) → CARD + DAY PASS (5s) → SPECIAL FACT (8s) → CTA (4s)
```

CTA always ends with: "...comment app or grab Travel Animator app from the link in bio."

Apply humanizer skill to remove AI patterns. Present the script and ask:
> "Here's the script. Approve, or tell me what to change?"

## Step 3: Get OSM Metro Line Path

Once script is approved, fetch the metro line geometry from OpenStreetMap Overpass API:
1. Find the OSM relation ID for the city's signature metro line
2. Fetch via: `curl -s "https://overpass-api.de/api/interpreter?data=[out:json];relation(RELATION_ID);(._;>;);out body;" -H "Accept: application/json"`
3. Extract coordinates, order ways, deduplicate
4. Downsample with Ramer-Douglas-Peucker algorithm to ~25-30 points

Present the plotting data:
> "Here are the points to plot in TravelAnimator:"
> - Number of points
> - Start station → End station
> - Train model to use (region-appropriate)
> - TA settings: 9:16, HD, Mercator, terrain map, duration = X seconds

Also provide the `create_route` MCP call if TA MCP is connected, or tell user to plot manually.

Ask: "Plot these points in TravelAnimator and export. Drop the video as `Metro/public/route-<id>-video.mp4` when ready."

## Step 4: Generate Audio

While user is doing TA export, generate audio:
1. Assign next available ID (read Metro/routes.json, find max ID, +1)
2. Add route entry to Metro/routes.json
3. Run: `cd Metro && npx tsx scripts/generate-audio.mts <id>`
4. Measure duration: `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 Metro/public/route-<id>-audio.wav`

Tell user the TA export duration should be set to: ceil(audio_duration) seconds.

## Step 5: Wait for Video Upload

Ask user to confirm they've uploaded the TA export:
> "Have you uploaded the video to `Metro/public/route-<id>-video.mp4`?"

Verify the file exists before proceeding.

## Step 6: Render

Run the full render pipeline:
1. Speed-adjust video to match audio
2. Extract hook clip (last 3s)
3. Copy assets to parent public/ if needed
4. Render MetroOverview composition
5. Open the output video

```bash
# From project root:
npx remotion render MetroOverview "Metro/out/route-<id>-<title>.mp4" --props="props.json" --gl=angle --concurrency=1
```

Ask: "Video rendered. Opening now — check it out. Approve for Instagram?"

## Step 7: Generate Instagram Caption

Once user approves the video, generate an Instagram caption following these rules:

**Caption structure:**
- Hook line (matches the video hook — creates curiosity/saves)
- 1-2 lines of value (the most save-worthy fact from the script)
- CTA line: "comment app for the link"
- Hashtag block (line break, then hashtags)

**Caption rules:**
- All lowercase, no period at end
- Short — under 150 characters before hashtags
- First line must stop the scroll (same energy as the video hook)
- Include city name and "metro" in first line for searchability

**Hashtags (15-20):**
- Always: #metro #subway #travel #travelhack #traveltips
- City-specific: #[city] #[city]travel #[country]
- Metro-specific: #[systemname] #[city]metro
- Discovery: #travelreels #savethis #travelhacks #instatravel #explorepage

**Example:**
```
tokyo metro in 30 seconds. save this before your japan trip

grab a suica card at the airport. tap in tap out. five dollar day pass rides unlimited all day

comment app for the link

#tokyo #tokyometro #japan #metro #subway #travel #travelhack #traveltips #tokyotravel #japantravel #travelreels #savethis #instatravel #travelhacks #explorepage
```

Present the caption and ask:
> "Here's the Instagram caption. Approve, or adjust?"

## Step 8: Final Summary

Once everything is approved, show the complete summary:

```
TMETRO Route <id>: <City> Metro in 30 Seconds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Video:     Metro/out/route-<id>-<title>.mp4
  Audio:     Metro/public/route-<id>-audio.wav
  Captions:  Metro/public/route-<id>-captions.json
  Duration:  ~<X>s + 5s outro
  Instagram: <caption>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ready to post!
```

## Important Rules

- NEVER skip a step or auto-proceed without user approval
- NEVER create content for India or low-GDP countries
- Always apply humanizer skill to scripts
- Audio MUST be generated before TA export (duration determines video length)
- Always use edge-tts (free), not ElevenLabs
- CTA ends at "link in bio" — no INSTA50 promo code
- Data pills in the composition are hardcoded per route — analyze captions to find timings for each section (distance, fare, card, day pass, last train)

# TMETRO — "[City] Metro in 30 Seconds" Pipeline

Complete pipeline for producing metro system overview reels for Instagram.

---

## Prerequisites

- Node.js 18+
- `ffmpeg` and `ffprobe` installed
- `python3` with `edge-tts` package (`pip install edge-tts`)
- Parent Remotion project set up (`npm install` in project root)
- TravelAnimator app on phone with MCP server enabled (for route plotting)

---

## Folder Structure

```
Metro/
├── data/
│   ├── metro-systems.json       # 61 cities — full research data (fares, hours, facilities, ratings)
│   └── metro-routes.json        # 93 T5 metro A→B routes
├── public/
│   ├── route-<id>-video.mp4     # [UPLOADED] TravelAnimator export
│   ├── route-<id>-audio.wav     # [GENERATED] edge-tts voiceover
│   ├── route-<id>-captions.json # [GENERATED] Whisper transcription
│   ├── route-<id>-hook.mp4      # [GENERATED] Last 3s of export (zoom-out)
│   ├── (symlinked shared assets from parent public/)
│   └── *.gpx                    # [GENERATED] Metro line GPX from OpenStreetMap
├── out/                          # Rendered output videos
├── routes.json                   # Metro route entries
├── scripts/
│   ├── generate-audio.mts        # edge-tts audio generation
│   └── render-all.mts            # Transcribe + Remotion render
├── package.json
└── SETUP.md                      # This file
```

---

## Pipeline — Step by Step

### Step 1: Pick City + Pull Data

Read from `Metro/data/metro-systems.json` (61 cities). All research is pre-loaded:
- Fares (single ride + day pass)
- Operating hours
- Frequency
- Network stats (km, lines, stations)
- Facilities
- Card tip, day pass tip
- Signature route
- Special fact / quirk
- Ratings (cleanliness, affordability, frequency, tourist-friendly, coverage)

### Step 2: Write Script

Follow the TMETRO template (see CLAUDE.md):

```
[HOOK — 2s]        [City] metro in thirty seconds.
[DISTANCE — 3s]    [X] kilometers of track across [Y] lines.
[ORIGIN — 4s]      Where tourists first encounter it (airport connection).
[FARE — 4s]        Station-to-station cost.
[CARD + DAY PASS — 5s] Which card, where to get it, day pass value line.
[SPECIAL FACT — 8s] The genuinely surprising thing about this metro.
[CTA — 4s]         ...comment app or grab Travel Animator app from the link in bio.
```

Apply humanizer skill before saving. Add entry to `Metro/routes.json`.

### Step 3: Generate Audio

```bash
cd Metro
npx tsx scripts/generate-audio.mts <id>
```

Output: `Metro/public/route-<id>-audio.wav`

### Step 4: Measure Audio Duration

```bash
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 \
  Metro/public/route-<id>-audio.wav
```

### Step 5: Get Metro Line Path from OpenStreetMap

Fetch the actual metro line geometry from OSM Overpass API:

```bash
# Find the OSM relation ID for the metro line (search on openstreetmap.org)
# Example: Tokyo Metro Ginza Line = relation 8026074

# Fetch and downsample to ~25-30 points using RDP algorithm
curl -s "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%3Brelation%28RELATION_ID%29%3B%28._%3B%3E%3B%29%3Bout%20body%3B" \
  -H "Accept: application/json" -o /tmp/metro-osm.json

# Process with Python (extract nodes, order ways, RDP downsample)
# See the pipeline script or ask Claude to process it
```

The downsampled points are used for TravelAnimator's `create_route` call.

### Step 6: Plot Route in TravelAnimator (via MCP)

```
1. clear_route
2. update_animation_state:
   - aspect_ratio: RATIO_9_16
   - resolution: RESOLUTION_HD
   - projection: MERCATOR
   - selected_map_id: 59 (Terrain)
   - video_duration: <audio duration in seconds>
   - model_size: 0.2
   - line_style: { type: AUTO, width: 4, color: #FFFFFF }
   - is_watermark_visible: false
3. create_route with downsampled OSM points (~25-30 points)
   - First point gets the train model (region-appropriate)
   - real_route: OFF (metro tunnels aren't in road data)
   - No annotations (known TA bug)
```

### Step 7: Export from TravelAnimator

Either via MCP (`export_video` → poll → download) or manually in the app.

Settings: 9:16, HD, Mercator, watermark off.

Save as: `Metro/public/route-<id>-video.mp4`

### Step 8: Speed-Adjust Video

```bash
# Match video duration to audio duration
AUDIO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 Metro/public/route-<id>-audio.wav)
VIDEO_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 Metro/public/route-<id>-video.mp4)
PTS=$(python3 -c "print($AUDIO_DUR / $VIDEO_DUR)")

ffmpeg -i Metro/public/route-<id>-video.mp4 \
  -filter:v "setpts=${PTS}*PTS" -an -c:v libx264 -preset fast -crf 18 \
  -y public/route-<id>-video-adjusted.mp4

# Extract hook clip (last 3s = zoom-out overview)
ffmpeg -sseof -3 -i Metro/public/route-<id>-video.mp4 \
  -c:v libx264 -preset fast -crf 18 -an \
  -y public/route-<id>-hook.mp4
```

### Step 9: Render with Remotion

```bash
# From project root:
npx remotion render MetroOverview "Metro/out/route-<id>-<title>.mp4" \
  --props="props.json" --gl=angle --concurrency=1

# props.json:
{
  "videoFile": "route-<id>-video-adjusted.mp4",
  "hookVideoFile": "route-<id>-hook.mp4",
  "audioFile": "route-<id>-audio.wav",
  "captionsFile": "route-<id>-captions.json",
  "logoFile": "logo.png",
  "outroFile": "ta-outro.mp4",
  "sfxFile": "train-voice.mp3",
  "routeTitle": "<City> Metro in 30 Seconds",
  "mainDurationInFrames": <ceil(audioDuration * 30)>,
  "outroDurationInFrames": 150,
  "videoPlaybackRate": 1
}
```

---

## Remotion Composition: MetroOverview

**File:** `src/MetroOverview.tsx`

**Visual layers:**
1. **Hook (0-3s):** Last 3s of TA export (zoom-out overview) + top black gradient. No spotlight.
2. **Dissolve transition (3-3.8s):** Hook fades out, main video fades in.
3. **Spotlight vignette:** Radial gradient — bright center (model), feathered dark edges. Fades in after dissolve.
4. **Data pills:** Stack one-by-one in top-left as each fact is spoken:
   - DISTANCE: X km · Y lines
   - FARE: $X – $Y
   - CARD: [name] ✓
   - DAY PASS: < $X / day ✓
   - LAST TRAIN: HH:MM AM/PM
5. **Dim captions:** SF Pro Rounded, white text. Spoken word = 100% opacity, others = 35%.
6. **Voiceover** at 1.5x volume + transport SFX with fade in/out.
7. **Outro:** ta-outro.mp4 appended.

**Data pill timings** are hardcoded per route based on caption word timestamps. When creating a new route, analyze the captions JSON to find when each section starts.

---

## Data Files

### metro-systems.json (61 cities)

Each entry contains:
```json
{
  "city": "Tokyo",
  "country": "Japan",
  "systemName": "Tokyo Metro",
  "fare": { "single": "...", "dayPass": "...", "currency": "..." },
  "hours": { "firstTrain": "...", "lastTrain": "...", "notes": "..." },
  "frequency": { "peak": "...", "offPeak": "..." },
  "network": { "lengthKm": 195, "lines": 9, "stations": 180 },
  "facilities": ["..."],
  "cardTip": "...",
  "dayPassTip": "...",
  "signatureRoute": { "from": "...", "to": "...", "line": "...", "time": "...", "fare": "...", "why": "..." },
  "specialFact": "...",
  "quirk": "...",
  "originPoint": "...",
  "ratings": { "cleanliness": 5, "affordability": 5, "frequency": 5, "touristFriendly": 4, "coverage": 4, "overall": 4.6 }
}
```

### Target Cities (no India, no low-GDP)

**Europe (35):** Tokyo, London, Paris, Berlin, Madrid, Barcelona, Rome, Lisbon, Amsterdam, Vienna, Prague, Budapest, Stockholm, Copenhagen, Athens, Munich, Glasgow, Bilbao, Porto, Milan, Naples, Brussels, Helsinki, Oslo, Warsaw, Bucharest, Lyon, Lille, Hamburg, Istanbul

**East Asia (12):** Tokyo, Osaka, Seoul, Singapore, Taipei, Hong Kong, Busan, Kyoto, Nagoya, Fukuoka, Sapporo

**Middle East (3):** Dubai, Riyadh, Doha

**Americas (14):** New York, Chicago, Washington DC, San Francisco, Los Angeles, Boston, Toronto, Montreal, Vancouver, Mexico City, Santiago, Sao Paulo, Rio de Janeiro, Buenos Aires, Medellin

**Southeast Asia (2):** Bangkok, Kuala Lumpur

**Oceania (1):** Sydney

---

## Instagram Handles (for tagging/engagement)

Top accounts: @metrodemedellin (582K), @metrodesantiago (444K), @transportforlondon (352K), @bvg_weilwirdichlieben (246K), @metro_madrid (183K), @metrocdmx (177K), @basubte (120K)

Full list in project memory.

---

## Content Potential

| Template | Count |
|----------|-------|
| TMETRO (city overview) | 61 videos |
| T5 Metro (A→B journeys) | 93+ routes |
| **Total** | **154+ metro videos** |

# TMETRO — "[City] Metro in 30 Seconds" Reels Pipeline

Automated video pipeline for Instagram Reels showcasing metro systems worldwide. Built with Remotion + TravelAnimator.

---

## What This Does

Produces 9:16 vertical Instagram Reels that cover a city's metro system in ~30 seconds. Each reel includes:
- Hook intro (zoom-out overview of the full route)
- Spotlight vignette effect on the train model
- Stacking data pills (distance, fare, card, day pass, last train)
- Dim-style captions (SF Pro Rounded, spoken word bright, others faded)
- Voiceover + transport SFX
- Brand outro

---

## Audience Rules

- **NEVER** create content featuring India or Indian cities/routes
- **NO** low-GDP countries — only high-tier cities
- Target: Europe, Americas, Middle East, Japan, East Asia, Southeast Asia, Oceania
- Platform: Instagram Reels (9:16 vertical)

---

## Content Template: TMETRO

**Hook:** Always "[City] metro in thirty seconds."

**Script structure (~30s):**
```
[HOOK — 2s]          [City] metro in thirty seconds.
[DISTANCE — 3s]      [X] km of track across [Y] lines.
[ORIGIN — 4s]        Where tourists first encounter it (airport connection).
[FARE — 4s]          Station-to-station cost.
[CARD + DAY PASS — 5s] Which card, where to get it. Day pass value line.
[SPECIAL FACT — 8s]  The genuinely surprising thing.
[CTA — 4s]           ...comment app or grab Travel Animator app from the link in bio.
```

**Visual layers:**
1. **Hook (0-3s):** Last 3s of TA export (zoom-out) + top black gradient. No spotlight.
2. **Dissolve (3-3.8s):** Hook fades out, main video fades in.
3. **Spotlight vignette:** Radial gradient — bright center, feathered dark edges. Fades in after dissolve.
4. **Data pills:** Stack top-left as each fact is spoken (distance, fare, card, day pass, last train).
5. **Dim captions:** SF Pro Rounded white. Spoken word = 100%, others = 35% opacity.
6. **Voiceover** 1.5x volume + transport SFX fade in/out.
7. **Outro:** ta-outro.mp4

**Visual-only overlays (planned, not yet built):**
- Facility pills (Contactless, AC, WiFi, Airport Link)
- Metro rating card (5 categories, 1-5 stars)

---

## CTA Rules

> "If you want to make travel animation videos like this for your own reels or get instant B-rolls for travel reels comment app or grab Travel Animator app from the link in bio."

- CTA ends at "link in bio" — NO promo code
- No question-type lines
- Must flow naturally from content

---

## Pipeline

### Step 1 — Pick City
Read from `data/metro-systems.json` (61 cities with full research data).

### Step 2 — Write Script
Follow TMETRO template. Apply humanizer. Save to `routes.json`.

### Step 3 — Generate Audio
```bash
npm run generate-audio -- <id>
```

### Step 4 — Get Metro Line from OpenStreetMap
```bash
# Fetch OSM relation → extract coordinates → RDP downsample to ~25 points
curl -s "https://overpass-api.de/api/interpreter?data=[out:json];relation(RELATION_ID);(._;>;);out body;" \
  -H "Accept: application/json" -o /tmp/metro-osm.json
# Process with Python (see SETUP.md for full script)
```

### Step 5 — Plot in TravelAnimator (MCP)
```
clear_route → update_animation_state (9:16, HD, Mercator, duration)
→ create_route with downsampled OSM points, real_route OFF
→ export_video → download
```

### Step 6 — Render
```bash
npm run render-all -- <id>
```

---

## TravelAnimator Export Settings

| Setting | Value |
|---------|-------|
| Aspect Ratio | `RATIO_9_16` |
| Resolution | `RESOLUTION_HD` |
| Projection | `MERCATOR` |
| Map | Terrain (id: 59) |
| Real Route | OFF (metro tunnels) |
| Watermark | OFF |
| Model | Region-appropriate train |

### Train Models by Region

| Region | Model | model_id | textureId |
|--------|-------|----------|-----------|
| Japan | Shinkansen | 241 | 305 |
| France | TGV Duplex | 246 | 310 |
| Germany | ICE Train | 245 | 309 |
| UK | Hitachi Express | 323 | 418 |
| US/Canada | Amtrak Train | 242 | 306 |
| Spain/Italy | Bullet Train | 108 | 117 |
| Default | Bullet Train | 108 | 117 |

---

## Data Files

### metro-systems.json (61 cities)

Full research data per city: fares, hours, frequency, network stats, facilities, card tip, day pass tip, signature route, special fact, quirk, origin point, ratings.

**Cities:** Tokyo, London, NYC, Paris, Seoul, Singapore, Dubai, Madrid, Barcelona, Berlin, Istanbul, Osaka, Rome, Lisbon, Amsterdam, Vienna, Prague, Budapest, Stockholm, Copenhagen, Athens, Munich, Glasgow, Bilbao, Porto, Milan, Naples, Brussels, Helsinki, Oslo, Warsaw, Bucharest, Lyon, Lille, Hamburg, Taipei, Hong Kong, Busan, Kyoto, Nagoya, Fukuoka, Sapporo, Riyadh, Doha, Chicago, Washington DC, San Francisco, LA, Boston, Toronto, Montreal, Vancouver, Mexico City, Santiago, Sao Paulo, Rio de Janeiro, Buenos Aires, Medellin, Bangkok, Kuala Lumpur, Sydney

### metro-routes.json (93 routes)

T5-style A→B metro journey routes with hook angles and story potential.

---

## Content Potential

| Template | Count |
|----------|-------|
| TMETRO (city overview) | 61 |
| T5 Metro (A→B journey) | 93+ |
| **Total** | **154+** |

---

## File Structure

```
tametro-reels/
├── src/
│   ├── Root.tsx              # Composition registration
│   ├── MetroOverview.tsx     # TMETRO composition (spotlight + pills + dim captions)
│   ├── Captions.tsx          # Caption styles (dim-style used by MetroOverview)
│   └── index.ts
├── data/
│   ├── metro-systems.json    # 61 cities research data
│   ├── metro-systems-new.json # Raw research for 46 additional cities
│   └── metro-routes.json     # 93 T5 metro A→B routes
├── scripts/
│   ├── generate-audio.mts    # edge-tts voiceover generation
│   └── render-all.mts        # Whisper transcribe + Remotion render
├── public/
│   ├── fonts/SF Pro Rounded/ # SF Pro Rounded font files
│   ├── logo.png              # TravelAnimator logo
│   ├── train-voice.mp3       # Train SFX
│   ├── plane-voice.mp3       # Plane SFX
│   └── ginza-line.gpx        # Sample: Tokyo Ginza Line GPX
├── routes.json               # Route entries for rendering
├── package.json
├── remotion.config.ts
├── tsconfig.json
├── CLAUDE.md                 # This file
└── SETUP.md                  # Detailed pipeline walkthrough
```

---

## npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Remotion studio (preview) |
| `npm run generate-audio -- <id>` | edge-tts voiceover |
| `npm run render-all -- <id>` | Transcribe + render |
| `npm run render` | Render MetroOverview composition |

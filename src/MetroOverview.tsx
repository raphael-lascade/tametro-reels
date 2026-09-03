import { z } from "zod";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  useDelayRender,
  interpolate,
  Easing,
} from "remotion";
import { Video, Audio } from "@remotion/media";
import type { Caption, TikTokPage } from "@remotion/captions";
import { createTikTokStyleCaptions } from "@remotion/captions";

const SF_ROUNDED_FAMILY = "SF Pro Rounded";

const SFRoundedFontLoader: React.FC = () => (
  <style>
    {`
      @font-face {
        font-family: "SF Pro Rounded";
        src: url("${staticFile("fonts/SF Pro Rounded/SF-Pro-Rounded-Bold.otf")}") format("opentype");
        font-weight: 700;
        font-style: normal;
      }
      @font-face {
        font-family: "SF Pro Rounded";
        src: url("${staticFile("fonts/SF Pro Rounded/SF-Pro-Rounded-Heavy.otf")}") format("opentype");
        font-weight: 800;
        font-style: normal;
      }
      @font-face {
        font-family: "SF Pro Rounded";
        src: url("${staticFile("fonts/SF Pro Rounded/SF-Pro-Rounded-Black.otf")}") format("opentype");
        font-weight: 900;
        font-style: normal;
      }
    `}
  </style>
);

export const MetroOverviewSchema = z.object({
  videoFile: z.string(),
  hookVideoFile: z.string(),
  audioFile: z.string(),
  captionsFile: z.string(),
  logoFile: z.string(),
  outroFile: z.string(),
  sfxFile: z.string(),
  routeTitle: z.string(),
  price: z.string().optional(),
  mainDurationInFrames: z.number(),
  outroDurationInFrames: z.number(),
  videoPlaybackRate: z.number(),
});

const SFX_VOLUME = 0.15;
const FADE_DURATION_SEC = 1.5;
const HOOK_DURATION_SEC = 3;
const DISSOLVE_DURATION_SEC = 0.8;
const SPOTLIGHT_FADE_SEC = 1.0;
const SWITCH_CAPTIONS_EVERY_MS = 1200;

// --- Dim-style captions ---
const DimCaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;
  const absoluteTimeMs = page.startMs + currentTimeMs;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        marginTop: "35%",
      }}
    >
      <div style={{ padding: "14px 28px", maxWidth: "85%" }}>
        <div
          style={{
            fontFamily: SF_ROUNDED_FAMILY,
            fontSize: 46,
            fontWeight: 700,
            textAlign: "center" as const,
            whiteSpace: "pre" as const,
            lineHeight: 1.3,
            textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)",
          }}
        >
          {page.tokens.map((token) => {
            const isActive =
              token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;
            return (
              <span
                key={token.fromMs}
                style={{
                  color: "#FFFFFF",
                  opacity: isActive ? 1 : 0.35,
                  transition: "none",
                }}
              >
                {token.text}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const DimCaptions: React.FC<{ captionsFile: string }> = ({ captionsFile }) => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading captions..."));
  const { fps } = useVideoConfig();

  const fetchCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile(captionsFile));
      const data = await response.json();
      setCaptions(data);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [captionsFile, continueRender, cancelRender, handle]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  const pages = useMemo(() => {
    if (!captions) return [];
    const { pages } = createTikTokStyleCaptions({
      captions,
      combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
    });
    return pages;
  }, [captions]);

  if (!captions) return null;

  return (
    <AbsoluteFill>
      {pages.map((page, index) => {
        const nextPage = pages[index + 1] ?? null;
        const startFrame = (page.startMs / 1000) * fps;
        const endFrame = Math.min(
          nextPage ? (nextPage.startMs / 1000) * fps : Infinity,
          startFrame + (SWITCH_CAPTIONS_EVERY_MS / 1000) * fps,
        );
        const durationInFrames = endFrame - startFrame;
        if (durationInFrames <= 0) return null;
        return (
          <Sequence key={index} from={startFrame} durationInFrames={durationInFrames}>
            <DimCaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// --- Main content ---
const MainContent: React.FC<{
  videoFile: string;
  hookVideoFile: string;
  audioFile: string;
  captionsFile: string;
  logoFile: string;
  sfxFile: string;
  routeTitle: string;
  price?: string;
  mainDurationInFrames: number;
  videoPlaybackRate: number;
}> = ({
  videoFile,
  hookVideoFile,
  audioFile,
  captionsFile,
  logoFile,
  sfxFile,
  routeTitle,
  price,
  mainDurationInFrames,
  videoPlaybackRate,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeFrames = Math.ceil(FADE_DURATION_SEC * fps);
  const hookFrames = Math.ceil(HOOK_DURATION_SEC * fps);
  const dissolveFrames = Math.ceil(DISSOLVE_DURATION_SEC * fps);
  const spotlightFadeFrames = Math.ceil(SPOTLIGHT_FADE_SEC * fps);

  const isInHook = frame < hookFrames;
  const transitionEnd = hookFrames + dissolveFrames;

  // --- Hook video opacity: visible during hook, fades out during dissolve ---
  const hookOpacity = interpolate(
    frame,
    [0, 10, hookFrames, transitionEnd],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // --- Main video opacity: fades in during dissolve, fades out at end ---
  const mainFadeIn = interpolate(
    frame,
    [hookFrames, transitionEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const mainFadeOut = interpolate(
    frame,
    [mainDurationInFrames - fadeFrames, mainDurationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const mainVideoOpacity = Math.min(mainFadeIn, mainFadeOut);

  // --- Spotlight: not during hook, fades in after dissolve ---
  const spotlightOpacity = interpolate(
    frame,
    [transitionEnd, transitionEnd + spotlightFadeFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // --- Top black gradient: only during hook, fades out ---
  const gradientOpacity = interpolate(
    frame,
    [0, 10, hookFrames - 10, hookFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // --- Data pills: each appears when spoken, stacks from top ---
  // Timings from caption analysis (in seconds)
  const dataPills = [
    { label: "DISTANCE", value: "195 km  ·  9 lines", icon: "📏", appearAt: 2.6 },
    { label: "FARE", value: "$1.20 – $1.80", icon: "💰", appearAt: 12.8 },
    { label: "CARD", value: "Suica", icon: "✓", appearAt: 17.3 },
    { label: "DAY PASS", value: "< $5 / day", icon: "✓", appearAt: 21.8 },
    { label: "LAST TRAIN", value: "12:30 AM", icon: "🕐", appearAt: 25.6 },
  ];

  // Hook title: only during hook, fades out at transition
  const hookTitleOpacity = interpolate(
    frame,
    [0, 10, hookFrames - 15, hookFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <SFRoundedFontLoader />

      {/* Layer 1a: Hook video — last 3s of export (zoom-out overview) */}
      <AbsoluteFill style={{ opacity: hookOpacity }}>
        <Video
          src={staticFile(hookVideoFile)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          muted
        />
      </AbsoluteFill>

      {/* Layer 1b: Main map video — starts playing after hook, dissolves in */}
      <Sequence from={hookFrames}>
        <AbsoluteFill style={{ opacity: mainVideoOpacity }}>
          <Video
            src={staticFile(videoFile)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            muted
            playbackRate={videoPlaybackRate}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Layer 2: Spotlight vignette — NOT during hook, fades in after transition */}
      <AbsoluteFill
        style={{
          opacity: spotlightOpacity,
          background:
            "radial-gradient(ellipse 45% 35% at 50% 50%, transparent 0%, transparent 40%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* Layer 2b: Top black gradient — ONLY during hook */}
      <AbsoluteFill
        style={{
          opacity: gradientOpacity,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 25%, transparent 50%)",
        }}
      />

      {/* Layer 3: Transport SFX */}
      <Audio
        src={staticFile(sfxFile)}
        loop
        volume={(f) => {
          const sfxIn = interpolate(f, [0, fadeFrames], [0, SFX_VOLUME], { extrapolateRight: "clamp" });
          const sfxOut = interpolate(f, [mainDurationInFrames - fadeFrames, mainDurationInFrames], [SFX_VOLUME, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return Math.min(sfxIn, sfxOut);
        }}
      />

      {/* Layer 4a: Hook title — ONLY during hook */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 180,
          opacity: hookTitleOpacity,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "90%", padding: "20px 40px" }}>
          <div
            style={{
              fontFamily: SF_ROUNDED_FAMILY,
              fontWeight: 900,
              fontSize: 72,
              color: "#FFFFFF",
              textTransform: "uppercase",
              letterSpacing: 3,
              lineHeight: 1.0,
              textShadow: "0 3px 10px rgba(0,0,0,0.85), 0 0 30px rgba(0,0,0,0.55)",
            }}
          >
            {routeTitle}
          </div>
        </div>
      </AbsoluteFill>

      {/* Layer 4b: Stacking data pills — appear when spoken, replace hook title area */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "flex-start",
          paddingTop: 140,
          paddingLeft: 48,
          paddingRight: 48,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dataPills.map((pill, i) => {
            const appearFrame = Math.ceil(pill.appearAt * fps);
            const pillFadeFrames = 12;
            const opacity = interpolate(
              frame,
              [appearFrame, appearFrame + pillFadeFrames],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const slideY = interpolate(
              frame,
              [appearFrame, appearFrame + pillFadeFrames],
              [12, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease) }
            );

            // Hide during hook
            if (frame < hookFrames) return null;

            return (
              <div
                key={i}
                style={{
                  opacity,
                  transform: `translateY(${slideY}px)`,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  backgroundColor: "rgba(0, 0, 0, 0.55)",
                  backdropFilter: "blur(8px)",
                  borderRadius: 14,
                  padding: "12px 22px",
                }}
              >
                <span style={{ fontSize: 22 }}>{pill.icon}</span>
                <span
                  style={{
                    fontFamily: SF_ROUNDED_FAMILY,
                    fontWeight: 700,
                    fontSize: 18,
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  {pill.label}
                </span>
                <span
                  style={{
                    fontFamily: SF_ROUNDED_FAMILY,
                    fontWeight: 800,
                    fontSize: 24,
                    color: "#FFFFFF",
                  }}
                >
                  {pill.value}
                </span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Layer 5: Voiceover */}
      <Audio src={staticFile(audioFile)} volume={1.5} />

      {/* Layer 6: Dim-style captions */}
      <DimCaptions captionsFile={captionsFile} />
    </AbsoluteFill>
  );
};

// --- Outro ---
const Outro: React.FC<{ outroFile: string }> = ({ outroFile }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Video
      src={staticFile(outroFile)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  </AbsoluteFill>
);

// --- Main composition ---
export const MetroOverview: React.FC<z.infer<typeof MetroOverviewSchema>> = ({
  videoFile,
  hookVideoFile,
  audioFile,
  captionsFile,
  logoFile,
  outroFile,
  sfxFile,
  routeTitle,
  price,
  mainDurationInFrames,
  outroDurationInFrames,
  videoPlaybackRate,
}) => {
  return (
    <Series>
      <Series.Sequence durationInFrames={mainDurationInFrames}>
        <MainContent
          videoFile={videoFile}
          hookVideoFile={hookVideoFile}
          audioFile={audioFile}
          captionsFile={captionsFile}
          logoFile={logoFile}
          sfxFile={sfxFile}
          routeTitle={routeTitle}
          price={price}
          mainDurationInFrames={mainDurationInFrames}
          videoPlaybackRate={videoPlaybackRate}
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={outroDurationInFrames}>
        <Outro outroFile={outroFile} />
      </Series.Sequence>
    </Series>
  );
};

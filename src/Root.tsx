import { Composition } from "remotion";
import { MetroOverview, MetroOverviewSchema } from "./MetroOverview";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* TMETRO — Metro Overview */}
      <Composition
        id="MetroOverview"
        component={MetroOverview}
        schema={MetroOverviewSchema}
        durationInFrames={30 * 50}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          videoFile: "sample-video.mp4",
          hookVideoFile: "sample-hook.mp4",
          audioFile: "sample-audio.wav",
          captionsFile: "sample-captions.json",
          logoFile: "logo.png",
          outroFile: "ta-outro.mp4",
          sfxFile: "train-voice.mp3",
          routeTitle: "Tokyo Metro in 30 Seconds",
          mainDurationInFrames: 30 * 41,
          outroDurationInFrames: 150,
          videoPlaybackRate: 1,
        }}
      />
    </>
  );
};

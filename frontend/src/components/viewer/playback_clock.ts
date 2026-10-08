// Shared playback clock: one timeline drives both the skeleton video and the 3D model.
// Kept in a ref (not React state) so the 3D render loop can read it every frame without re-rendering.

export interface PlaybackClock {
  currentTime: number;
  durationSeconds: number;
  isPlaying: boolean;
}

/** New clock stopped at 0 with the default 2 s UniMate clip length. */
export function createPlaybackClock(durationSeconds = 2): PlaybackClock {
  return { currentTime: 0, durationSeconds, isPlaying: false };
}

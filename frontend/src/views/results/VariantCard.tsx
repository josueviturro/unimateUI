import { useCallback, useEffect, useRef, useState } from "react";
import type { ExportScale, RunVariant } from "../../api/api_types";
import { ActionButton, LinkButton } from "../../components/common/ActionButton";
import { AnimatedModelViewer } from "../../components/viewer/AnimatedModelViewer";
import { createPlaybackClock, type PlaybackClock } from "../../components/viewer/playback_clock";
import { LoopControls } from "./LoopControls";
import styles from "./VariantCard.module.css";

export type { ExportScale };

const CLIP_FPS = 30;
const VIDEO_RESYNC_TOLERANCE_SECONDS = 0.25;

type PlaybackMode = "clip" | "loop";

interface VariantCardProps {
  runName: string;
  variantLetter: string;
  variant: RunVariant;
  prompt: string;
  exportScale: ExportScale;
  onToggleFavorite: (variant: RunVariant) => void;
  onVariantChanged: () => void;
}

/** One generated variant: skeleton video + 3D GLB on a shared timeline, loop tools, seed/CFG info and downloads. */
export function VariantCard({ runName, variantLetter, variant, prompt, exportScale, onToggleFavorite, onVariantChanged }: VariantCardProps) {
  const playbackClockRef = useRef<PlaybackClock>(createPlaybackClock());
  const videoRef = useRef<HTMLVideoElement>(null);
  const [displayedFrame, setDisplayedFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(2);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoopPanelOpen, setIsLoopPanelOpen] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("clip");

  const isOriginalScale = exportScale === "original";
  const clipGlbUrl = isOriginalScale ? variant.original_glb_url : variant.canonical_glb_url;
  const clipFbxUrl = isOriginalScale ? variant.original_fbx_url : variant.canonical_fbx_url;
  const loopGlbUrl = isOriginalScale ? variant.original_loop_glb_url : variant.canonical_loop_glb_url;
  const loopFbxUrl = isOriginalScale ? variant.original_loop_fbx_url : variant.canonical_loop_fbx_url;
  const loopReport = isOriginalScale ? variant.original_loop_report : variant.canonical_loop_report;
  const hasLoop = loopGlbUrl !== null;
  const isShowingLoop = playbackMode === "loop" && hasLoop;
  const glbUrl = isShowingLoop ? loopGlbUrl : clipGlbUrl;
  const fbxUrl = isShowingLoop ? loopFbxUrl : clipFbxUrl;
  // a 60-frame clip lasts 59/30 s (first to last keyframe), so frames = duration × fps + 1
  const totalFrames = Math.round(durationSeconds * CLIP_FPS) + 1;

  useEffect(() => {
    // advance the shared clock while playing and loop at the end of the clip
    let animationFrameId = 0;
    let previousTimestamp = performance.now();

    /** One animation frame: move the clock and keep the video close to it. */
    const advanceClock = (currentTimestamp: number) => {
      const playbackClock = playbackClockRef.current;
      const elapsedSeconds = (currentTimestamp - previousTimestamp) / 1000;
      previousTimestamp = currentTimestamp;
      if (playbackClock.isPlaying) {
        playbackClock.currentTime = (playbackClock.currentTime + elapsedSeconds) % playbackClock.durationSeconds;
        const videoElement = videoRef.current;
        // only resync a video that has data: seeking an unloaded video restarts its download
        if (videoElement && videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          && Math.abs(videoElement.currentTime - playbackClock.currentTime) > VIDEO_RESYNC_TOLERANCE_SECONDS) {
          videoElement.currentTime = playbackClock.currentTime;
        }
        setDisplayedFrame(Math.floor(playbackClock.currentTime * CLIP_FPS));
      }
      animationFrameId = requestAnimationFrame(advanceClock);
    };
    animationFrameId = requestAnimationFrame(advanceClock);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    // Escape closes the enlarged view
    if (!isExpanded) return undefined;

    /** Close the enlarged view when Escape is pressed. */
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  /** Clip length from the GLB animation (chained runs are longer than 2 s, loops shorter). */
  const handleDurationKnown = useCallback((clipDurationSeconds: number) => {
    if (clipDurationSeconds > 0) {
      playbackClockRef.current.durationSeconds = clipDurationSeconds;
      playbackClockRef.current.currentTime %= clipDurationSeconds;
      setDurationSeconds(clipDurationSeconds);
    }
  }, []);

  /** Video metadata gives the duration when there is no GLB yet. */
  const handleVideoMetadata = () => {
    const videoDuration = videoRef.current?.duration;
    if (!glbUrl && videoDuration && Number.isFinite(videoDuration)) handleDurationKnown(videoDuration);
  };

  /** Start or pause both the video and the 3D model. */
  const handlePlayToggle = () => {
    const playbackClock = playbackClockRef.current;
    playbackClock.isPlaying = !playbackClock.isPlaying;
    setIsPlaying(playbackClock.isPlaying);
    const videoElement = videoRef.current;
    if (!videoElement) return;
    if (playbackClock.isPlaying) {
      videoElement.currentTime = playbackClock.currentTime;
      void videoElement.play().catch(() => undefined);
    } else {
      videoElement.pause();
    }
  };

  /** Jump to a frame (pauses playback). */
  const handleScrub = (targetFrame: number) => {
    const playbackClock = playbackClockRef.current;
    playbackClock.isPlaying = false;
    playbackClock.currentTime = Math.min(targetFrame / CLIP_FPS, playbackClock.durationSeconds - 0.001);
    setIsPlaying(false);
    setDisplayedFrame(targetFrame);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = playbackClock.currentTime;
    }
  };

  /** Switch between the original clip and its loop, restarting from frame 0. */
  const handlePlaybackModeChange = (nextMode: PlaybackMode) => {
    playbackClockRef.current.currentTime = 0;
    setDisplayedFrame(0);
    setPlaybackMode(nextMode);
  };

  /** A new loop exists: refresh the run, show the loop and start playing it. */
  const handleLoopReady = () => {
    onVariantChanged();
    setIsLoopPanelOpen(false);
    handlePlaybackModeChange("loop");
    playbackClockRef.current.isPlaying = true;
    setIsPlaying(true);
  };

  return (
    <>
      {isExpanded && <div className={styles.backdrop_variant_expanded} onClick={() => setIsExpanded(false)} aria-hidden="true" />}
      <article className={[
        styles.card_variant,
        variant.favorite ? styles.card_variant_favorite : "",
        isExpanded ? styles.card_variant_expanded : "",
      ].join(" ")}>
        <header className={styles.header_variant}>
          <span className={styles.text_variant_title}>
            <span className={styles.dot_variant_marker} aria-hidden="true" />
            Variante {variantLetter}
          </span>
          <div className={styles.container_variant_header_actions}>
            <button type="button" className={`${styles.button_favorite} ${variant.favorite ? styles.button_favorite_active : ""}`}
              onClick={() => onToggleFavorite(variant)} aria-pressed={variant.favorite}>
              {variant.favorite ? "★" : "☆"} Favorito
            </button>
            <button type="button" className={`${styles.button_loop_toggle} ${isLoopPanelOpen ? styles.button_loop_toggle_active : ""}`}
              onClick={() => setIsLoopPanelOpen(!isLoopPanelOpen)} aria-expanded={isLoopPanelOpen}
              title="Convertir esta variante en una animación que se repite sin corte">
              ⟲ Loop
            </button>
            <button type="button" className={styles.button_expand_variant} onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Volver al tamaño normal (Esc)" : "Ampliar esta variante"}>
              {isExpanded ? "✕ Cerrar" : "⛶ Ampliar"}
            </button>
          </div>
        </header>

        {isLoopPanelOpen && (
          <LoopControls runName={runName} sampleStem={variant.sample_stem} exportScale={exportScale}
            existingReport={loopReport} isSourceExported={clipGlbUrl !== null} onLoopReady={handleLoopReady} />
        )}

        {hasLoop && (
          <div className={styles.container_playback_mode} role="tablist">
            <button type="button" role="tab" aria-selected={!isShowingLoop}
              className={`${styles.button_playback_mode} ${!isShowingLoop ? styles.button_playback_mode_active : ""}`}
              onClick={() => handlePlaybackModeChange("clip")}>
              Clip original
            </button>
            <button type="button" role="tab" aria-selected={isShowingLoop}
              className={`${styles.button_playback_mode} ${isShowingLoop ? styles.button_playback_mode_active : ""}`}
              onClick={() => handlePlaybackModeChange("loop")}>
              ⟲ Loop
            </button>
          </div>
        )}

        <div className={`${styles.grid_variant_previews} ${isShowingLoop ? styles.grid_variant_previews_single : ""}`}>
          {!isShowingLoop && (
            <div className={styles.pane_variant_preview}>
              <span className={styles.label_preview_pane}>● Esqueleto</span>
              {variant.preview_video_url ? (
                <video ref={videoRef} className={styles.video_skeleton_preview} src={variant.preview_video_url} muted playsInline loop
                  preload="auto" onLoadedMetadata={handleVideoMetadata} />
              ) : <p className={styles.text_preview_missing}>Sin video de vista previa</p>}
            </div>
          )}
          <div className={styles.pane_variant_preview}>
            <span className={styles.label_preview_pane}>{isShowingLoop ? "● Loop (se repite sin corte)" : "● Visor 3D GLB"}</span>
            {glbUrl ? (
              <AnimatedModelViewer glbUrl={glbUrl} playbackClockRef={playbackClockRef} onDurationKnown={handleDurationKnown}
                overlayLabel={`${isOriginalScale ? "Escala original" : "Canónico"}${isShowingLoop ? " · loop" : ""}`} />
            ) : (
              <p className={styles.text_preview_missing}>
                {isOriginalScale ? "Todavía no exportado a escala original" : "Todavía no exportado a GLB"}
              </p>
            )}
          </div>
        </div>

        <div className={styles.container_variant_timeline}>
          <div className={styles.row_timeline_controls}>
            <button type="button" className={styles.button_play_toggle} onClick={handlePlayToggle} aria-label={isPlaying ? "Pausar" : "Reproducir"}>
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <span className={styles.text_timeline_position}>
              {(displayedFrame / CLIP_FPS).toFixed(1)} s ({displayedFrame} / {totalFrames} frames)
            </span>
            <span className={styles.text_timeline_range}>0 – {durationSeconds.toFixed(1)} s</span>
          </div>
          <input type="range" className={styles.input_timeline_scrubber} min={0} max={Math.max(0, totalFrames - 1)} step={1}
            value={displayedFrame} onChange={(changeEvent) => handleScrub(Number(changeEvent.target.value))} aria-label="Línea de tiempo" />
        </div>

        <dl className={styles.list_variant_details}>
          <div className={styles.item_variant_detail}><dt>Semilla</dt><dd>{variant.seed ?? "—"}</dd></div>
          <div className={styles.item_variant_detail}><dt>CFG</dt><dd className={styles.text_cfg_value}>{variant.cfg_scale ?? "—"}</dd></div>
          {isShowingLoop && loopReport && (
            <div className={styles.item_variant_detail}>
              <dt>Ciclo</dt>
              <dd>frames {loopReport.start_frame}–{loopReport.end_frame} · {loopReport.loop_seconds} s{loopReport.in_place ? " · en el lugar" : ""}</dd>
            </div>
          )}
          <div className={styles.item_variant_prompt}><dt>Prompt</dt><dd>“{prompt}”</dd></div>
        </dl>

        <div className={styles.grid_variant_downloads}>
          <LinkButton href={glbUrl} iconSymbol="⤓" size="small">{isShowingLoop ? "GLB del loop" : "Descargar GLB"}</LinkButton>
          <LinkButton href={fbxUrl} iconSymbol="⤓" size="small">{isShowingLoop ? "FBX del loop" : "Descargar FBX"}</LinkButton>
        </div>
      </article>
    </>
  );
}

interface CaseSimilarButtonProps {
  isDisabled: boolean;
  onClick: () => void;
}

/** "Generate more like these": same prompt and character with a new seed. */
export function CaseSimilarButton({ isDisabled, onClick }: CaseSimilarButtonProps) {
  return (
    <ActionButton size="small" iconSymbol="⟳" onClick={onClick} disabled={isDisabled} title="Mismo prompt, otra semilla">
      Generar más parecidas
    </ActionButton>
  );
}

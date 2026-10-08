import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  progressFraction: number | null;
  sizeVariant?: "thin" | "thick";
  tone?: "gradient" | "vram";
}

/** Horizontal bar; null progress renders an indeterminate (sliding) animation. */
export function ProgressBar({ progressFraction, sizeVariant = "thick", tone = "gradient" }: ProgressBarProps) {
  const isIndeterminate = progressFraction === null;
  const clampedPercent = isIndeterminate ? 0 : Math.min(100, Math.max(0, progressFraction * 100));
  const vramToneClass = clampedPercent > 90 ? styles.fill_vram_critical
    : clampedPercent > 70 ? styles.fill_vram_high : styles.fill_vram_normal;
  return (
    <div
      className={`${styles.track_progress_bar} ${styles[`track_size_${sizeVariant}`]}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isIndeterminate ? undefined : Math.round(clampedPercent)}
    >
      <div
        className={[
          styles.fill_progress_bar,
          isIndeterminate ? styles.fill_indeterminate : "",
          tone === "vram" ? vramToneClass : styles.fill_gradient,
        ].join(" ")}
        style={isIndeterminate ? undefined : { width: `${clampedPercent}%` }}
      />
    </div>
  );
}

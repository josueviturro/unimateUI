import type { ReactNode } from "react";
import styles from "./SliderField.module.css";

interface SliderFieldProps {
  label: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  stepSize: number;
  onValueChange: (nextValue: number) => void;
  valueSuffix?: string;
  scaleHints?: [ReactNode, ReactNode, ReactNode];
  accentTone?: "primary" | "secondary";
}

/** Labelled range slider with its current value badge and min/default/max hints. */
export function SliderField({ label, value, minimumValue, maximumValue, stepSize, onValueChange, valueSuffix = "",
  scaleHints, accentTone = "primary" }: SliderFieldProps) {
  const fillPercent = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;
  return (
    <div className={styles.container_slider_field}>
      <div className={styles.row_slider_header}>
        <label className={styles.text_slider_label}>{label}</label>
        <span className={`${styles.badge_slider_value} ${styles[`badge_tone_${accentTone}`]}`}>
          {value}{valueSuffix}
        </span>
      </div>
      <input
        type="range"
        className={`${styles.input_slider_range} ${styles[`slider_tone_${accentTone}`]}`}
        min={minimumValue}
        max={maximumValue}
        step={stepSize}
        value={value}
        style={{ ["--slider_fill_percent" as string]: `${fillPercent}%` }}
        onChange={(changeEvent) => onValueChange(Number(changeEvent.target.value))}
        aria-label={label}
      />
      {scaleHints && (
        <div className={styles.row_slider_hints}>
          <span>{scaleHints[0]}</span>
          <span>{scaleHints[1]}</span>
          <span>{scaleHints[2]}</span>
        </div>
      )}
    </div>
  );
}

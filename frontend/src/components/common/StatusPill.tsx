import type { ReactNode } from "react";
import type { StatusTone } from "../../utils/formatters";
import styles from "./StatusPill.module.css";

interface StatusPillProps {
  tone: StatusTone;
  children: ReactNode;
  isPulsing?: boolean;
}

/** Small rounded status chip with a colored LED dot. */
export function StatusPill({ tone, children, isPulsing = false }: StatusPillProps) {
  return (
    <span className={`${styles.pill_status} ${styles[`pill_tone_${tone}`]}`}>
      <span className={`${styles.dot_status_led} ${isPulsing ? styles.dot_status_pulsing : ""}`} aria-hidden="true" />
      {children}
    </span>
  );
}

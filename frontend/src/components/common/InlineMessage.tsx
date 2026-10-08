import type { ReactNode } from "react";
import styles from "./InlineMessage.module.css";

export type InlineMessageTone = "info" | "warning" | "danger" | "success";

const TONE_SYMBOLS: Record<InlineMessageTone, string> = {
  info: "ℹ",
  warning: "⚠",
  danger: "✖",
  success: "✔",
};

interface InlineMessageProps {
  tone: InlineMessageTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}

/** Colored notice box (hints, warnings, errors) with optional title and actions. */
export function InlineMessage({ tone, title, children, actions }: InlineMessageProps) {
  return (
    <div className={`${styles.container_inline_message} ${styles[`message_tone_${tone}`]}`} role={tone === "danger" ? "alert" : "status"}>
      <span className={styles.icon_inline_message} aria-hidden="true">{TONE_SYMBOLS[tone]}</span>
      <div className={styles.container_inline_message_body}>
        {title && <strong className={styles.text_inline_message_title}>{title}</strong>}
        {children && <div className={styles.text_inline_message_content}>{children}</div>}
      </div>
      {actions && <div className={styles.container_inline_message_actions}>{actions}</div>}
    </div>
  );
}

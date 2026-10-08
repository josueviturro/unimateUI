import type { ReactNode } from "react";
import styles from "./PanelSection.module.css";

interface PanelSectionProps {
  title?: ReactNode;
  iconSymbol?: ReactNode;
  headerExtra?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  hasBodyPadding?: boolean;
}

/** Docked panel with an optional header (icon, title, right-side extra) and a body. */
export function PanelSection({ title, iconSymbol, headerExtra, description, children, className,
  hasBodyPadding = true }: PanelSectionProps) {
  return (
    <section className={`${styles.panel_section} ${className ?? ""}`}>
      {(title || headerExtra) && (
        <header className={styles.header_panel_section}>
          <div className={styles.container_panel_title}>
            {iconSymbol && <span className={styles.icon_panel_title} aria-hidden="true">{iconSymbol}</span>}
            <h2 className={styles.text_panel_title}>{title}</h2>
          </div>
          {headerExtra && <div className={styles.container_panel_header_extra}>{headerExtra}</div>}
        </header>
      )}
      {description && <p className={styles.text_panel_description}>{description}</p>}
      <div className={hasBodyPadding ? styles.body_panel_section_padded : styles.body_panel_section}>{children}</div>
    </section>
  );
}

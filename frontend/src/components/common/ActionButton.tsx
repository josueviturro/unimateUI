import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./ActionButton.module.css";

export type ActionButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ActionButtonSize = "small" | "medium" | "large";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  iconSymbol?: ReactNode;
  isFullWidth?: boolean;
}

/** Button used everywhere: one look per variant (primary = run/generate, danger = cancel/delete). */
export function ActionButton({ variant = "secondary", size = "medium", iconSymbol, isFullWidth = false,
  className, children, type = "button", ...buttonProps }: ActionButtonProps) {
  const classNames = [
    styles.button_action,
    styles[`button_variant_${variant}`],
    styles[`button_size_${size}`],
    isFullWidth ? styles.button_full_width : "",
    className ?? "",
  ].join(" ");
  return (
    <button type={type} className={classNames} {...buttonProps}>
      {iconSymbol !== undefined && <span className={styles.icon_button_symbol} aria-hidden="true">{iconSymbol}</span>}
      {children}
    </button>
  );
}

interface LinkButtonProps {
  href: string | null;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  iconSymbol?: ReactNode;
  isFullWidth?: boolean;
  downloadName?: string;
  children: ReactNode;
}

/** Same look as ActionButton but as a download/link; renders disabled when there is no URL. */
export function LinkButton({ href, variant = "secondary", size = "medium", iconSymbol, isFullWidth = false,
  downloadName, children }: LinkButtonProps) {
  const classNames = [
    styles.button_action,
    styles[`button_variant_${variant}`],
    styles[`button_size_${size}`],
    isFullWidth ? styles.button_full_width : "",
    href ? "" : styles.button_link_disabled,
  ].join(" ");
  return (
    <a className={classNames} href={href ?? undefined} download={downloadName ?? true} aria-disabled={!href}>
      {iconSymbol !== undefined && <span className={styles.icon_button_symbol} aria-hidden="true">{iconSymbol}</span>}
      {children}
    </a>
  );
}

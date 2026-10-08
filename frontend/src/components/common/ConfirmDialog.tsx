import { useEffect, useRef, type ReactNode } from "react";
import { ActionButton } from "./ActionButton";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal confirmation for irreversible actions (delete run, delete character). */
export function ConfirmDialog({ isOpen, title, children, confirmLabel, isDanger = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) return;
    if (isOpen && !dialogElement.open) dialogElement.showModal();
    if (!isOpen && dialogElement.open) dialogElement.close();
  }, [isOpen]);

  return (
    <dialog ref={dialogRef} className={styles.dialog_confirm} onCancel={onCancel}>
      <h2 className={styles.text_dialog_title}>{title}</h2>
      <div className={styles.text_dialog_body}>{children}</div>
      <div className={styles.container_dialog_actions}>
        <ActionButton variant="ghost" onClick={onCancel}>Cancelar</ActionButton>
        <ActionButton variant={isDanger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</ActionButton>
      </div>
    </dialog>
  );
}

// Display helpers: dates, sizes, durations and status labels in Spanish.

import type { AssetStatus, JobStatus, RunStatus } from "../api/api_types";

const BYTES_PER_KILOBYTE = 1024;
const SECONDS_PER_MINUTE = 60;

/** "1.4 GB", "820 MB"... */
export function formatBytes(byteCount: number): string {
  const unitNames = ["B", "KB", "MB", "GB", "TB"];
  let scaledValue = byteCount;
  let unitIndex = 0;
  while (scaledValue >= BYTES_PER_KILOBYTE && unitIndex < unitNames.length - 1) {
    scaledValue /= BYTES_PER_KILOBYTE;
    unitIndex += 1;
  }
  return `${scaledValue.toFixed(unitIndex === 0 ? 0 : 1)} ${unitNames[unitIndex]}`;
}

/** "Hoy, 15:02" / "Ayer, 18:42" / "06/10, 11:15" from a Unix timestamp in seconds. */
export function formatRunDate(unixSeconds: number): string {
  const runDate = new Date(unixSeconds * 1000);
  const timeText = runDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const todayDate = new Date();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(todayDate.getDate() - 1);
  if (runDate.toDateString() === todayDate.toDateString()) return `Hoy, ${timeText}`;
  if (runDate.toDateString() === yesterdayDate.toDateString()) return `Ayer, ${timeText}`;
  return `${runDate.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}, ${timeText}`;
}

/** "01:07" from a number of seconds. */
export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutePart = Math.floor(safeSeconds / SECONDS_PER_MINUTE);
  const secondPart = safeSeconds % SECONDS_PER_MINUTE;
  return `${String(minutePart).padStart(2, "0")}:${String(secondPart).padStart(2, "0")}`;
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusPresentation {
  label: string;
  tone: StatusTone;
}

/** Label and color tone of a character status. */
export function describeAssetStatus(assetStatus: AssetStatus): StatusPresentation {
  const presentations: Record<AssetStatus, StatusPresentation> = {
    ready: { label: "Listo", tone: "success" },
    review: { label: "Necesita revisión", tone: "warning" },
    too_many_joints: { label: "No entra", tone: "danger" },
    processing: { label: "Procesando", tone: "info" },
    failed: { label: "Error", tone: "danger" },
    empty: { label: "Sin procesar", tone: "neutral" },
  };
  return presentations[assetStatus];
}

/** Label and color tone of a run status. */
export function describeRunStatus(runStatus: RunStatus): StatusPresentation {
  const presentations: Record<RunStatus, StatusPresentation> = {
    completed: { label: "Completado", tone: "success" },
    running: { label: "En ejecución", tone: "info" },
    not_animated: { label: "Sin exportar", tone: "warning" },
    failed: { label: "Error", tone: "danger" },
    cancelled: { label: "Cancelado", tone: "neutral" },
  };
  return presentations[runStatus];
}

/** Label and color tone of a job status. */
export function describeJobStatus(jobStatus: JobStatus): StatusPresentation {
  const presentations: Record<JobStatus, StatusPresentation> = {
    queued: { label: "En cola", tone: "neutral" },
    running: { label: "En ejecución", tone: "info" },
    completed: { label: "Completado", tone: "success" },
    failed: { label: "Error", tone: "danger" },
    cancelled: { label: "Cancelado", tone: "neutral" },
  };
  return presentations[jobStatus];
}

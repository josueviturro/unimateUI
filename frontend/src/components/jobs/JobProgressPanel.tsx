import { useEffect, useRef, useState } from "react";
import { apiClient } from "../../api/api_client";
import type { JobSummary } from "../../api/api_types";
import { useJobStream } from "../../hooks/useJobStream";
import { describeJobStatus, formatDuration } from "../../utils/formatters";
import { ActionButton } from "../common/ActionButton";
import { InlineMessage } from "../common/InlineMessage";
import { ProgressBar } from "../common/ProgressBar";
import { StatusPill } from "../common/StatusPill";
import styles from "./JobProgressPanel.module.css";

const CLOCK_TICK_MILLISECONDS = 1000;
const AUTO_SCROLL_THRESHOLD_PIXELS = 40;

interface JobProgressPanelProps {
  jobId: string;
  title: string;
  onFinished?: (finishedJob: JobSummary) => void;
  consoleHeight?: "compact" | "tall";
}

/** Live job view: status, progress bar, elapsed/remaining time, cancel button and the log console. */
export function JobProgressPanel({ jobId, title, onFinished, consoleHeight = "tall" }: JobProgressPanelProps) {
  const { jobSummary, logEntries, isFinished, connectionError } = useJobStream(jobId, onFinished);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now() / 1000);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFinished) return undefined;
    const clockTimer = window.setInterval(() => setCurrentTimestamp(Date.now() / 1000), CLOCK_TICK_MILLISECONDS);
    return () => window.clearInterval(clockTimer);
  }, [isFinished]);

  useEffect(() => {
    if (isAutoScrollEnabled && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logEntries, isAutoScrollEnabled]);

  /** Turn auto-scroll off when the user scrolls up, back on when they reach the bottom. */
  const handleConsoleScroll = () => {
    const consoleElement = consoleRef.current;
    if (!consoleElement) return;
    const distanceFromBottom = consoleElement.scrollHeight - consoleElement.scrollTop - consoleElement.clientHeight;
    setIsAutoScrollEnabled(distanceFromBottom < AUTO_SCROLL_THRESHOLD_PIXELS);
  };

  /** Ask the backend to cancel (kills the whole process tree). */
  const handleCancelClick = async () => {
    setIsCancelling(true);
    try {
      await apiClient.cancelJob(jobId);
    } finally {
      setIsCancelling(false);
    }
  };

  const statusPresentation = jobSummary ? describeJobStatus(jobSummary.status) : describeJobStatus("queued");
  const progressFraction = jobSummary?.progress ?? null;
  const elapsedSeconds = jobSummary?.started_at
    ? (jobSummary.finished_at ?? currentTimestamp) - jobSummary.started_at : 0;
  const remainingSeconds = progressFraction && progressFraction > 0.05 && !isFinished
    ? elapsedSeconds * (1 - progressFraction) / progressFraction : null;

  return (
    <section className={styles.panel_job_progress}>
      <header className={styles.header_job_progress}>
        <div className={styles.container_job_title}>
          <h2 className={styles.text_job_title}>{title}</h2>
          <StatusPill tone={statusPresentation.tone} isPulsing={jobSummary?.status === "running"}>
            {statusPresentation.label}
          </StatusPill>
        </div>
        <div className={styles.container_job_actions}>
          <span className={styles.text_job_phase}>
            {jobSummary ? `${jobSummary.phase} [${jobSummary.current_step}/${jobSummary.total_steps}]` : "Conectando…"}
          </span>
          {!isFinished && (
            <ActionButton variant="danger" size="small" iconSymbol="⊗" onClick={handleCancelClick} disabled={isCancelling}>
              Cancelar
            </ActionButton>
          )}
        </div>
      </header>

      <div className={styles.container_job_progress_bar}>
        <div className={styles.row_progress_labels}>
          <span>{jobSummary?.status === "queued" ? "Esperando que la GPU se libere…" : "Progreso"}</span>
          <span className={styles.text_progress_percent}>
            {progressFraction === null ? "—" : `${Math.round(progressFraction * 100)}%`}
          </span>
        </div>
        <ProgressBar progressFraction={isFinished ? 1 : progressFraction} />
        <div className={styles.row_progress_labels}>
          <span>Tiempo transcurrido: {formatDuration(elapsedSeconds)}</span>
          <span>{remainingSeconds !== null ? `Restante estimado: ~${formatDuration(remainingSeconds)}` : ""}</span>
        </div>
      </div>

      {jobSummary?.status === "failed" && (
        <InlineMessage tone="danger" title="El trabajo falló">
          {jobSummary.error_message ?? "Revisá el log para ver el motivo."}
        </InlineMessage>
      )}
      {connectionError && <InlineMessage tone="warning">{connectionError}</InlineMessage>}

      <div className={styles.container_log_console}>
        <div className={styles.header_log_console}>
          <span className={styles.container_console_dots} aria-hidden="true">
            <span className={styles.dot_console_red} />
            <span className={styles.dot_console_amber} />
            <span className={styles.dot_console_green} />
          </span>
          <span className={styles.text_console_title}>Consola de log UniMate</span>
          <span className={styles.text_console_autoscroll}>
            {isAutoScrollEnabled ? "● Desplazamiento automático" : "○ Pausado (bajá para reanudar)"}
          </span>
        </div>
        <div
          ref={consoleRef}
          className={`${styles.body_log_console} ${consoleHeight === "compact" ? styles.body_console_compact : styles.body_console_tall}`}
          onScroll={handleConsoleScroll}
        >
          {logEntries.map((logEntry, logIndex) => (
            <div key={logIndex} className={`${styles.row_log_line} ${styles[`log_level_${logEntry.level}`]}`}>
              <span className={styles.text_log_time}>[{logEntry.time}]</span>
              <span className={styles.text_log_message}>{logEntry.text}</span>
            </div>
          ))}
          {!isFinished && <span className={styles.cursor_console_blink} aria-hidden="true" />}
        </div>
      </div>
    </section>
  );
}

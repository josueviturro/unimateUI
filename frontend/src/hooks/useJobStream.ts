import { useEffect, useRef, useState } from "react";
import { apiClient } from "../api/api_client";
import type { JobSummary, LogEntry } from "../api/api_types";

const FINISHED_JOB_STATUSES = ["completed", "failed", "cancelled"];

interface JobStreamState {
  jobSummary: JobSummary | null;
  logEntries: LogEntry[];
  isFinished: boolean;
  connectionError: string | null;
}

/**
 * Follow a job live through Server-Sent Events: its log lines and progress.
 * Calls `onFinished` once when the job ends (completed, failed or cancelled).
 */
export function useJobStream(jobId: string | null, onFinished?: (finishedJob: JobSummary) => void): JobStreamState {
  const [jobSummary, setJobSummary] = useState<JobSummary | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const finishedCallbackRef = useRef(onFinished);
  finishedCallbackRef.current = onFinished;

  useEffect(() => {
    setJobSummary(null);
    setLogEntries([]);
    setConnectionError(null);
    if (!jobId) return undefined;

    let finishedNotified = false;
    const eventSource = new EventSource(apiClient.buildJobEventsUrl(jobId));

    /** Place newly received log lines at their position (a reconnect resends from line 0). */
    const handleLogEvent = (messageEvent: MessageEvent<string>) => {
      const logChunk = JSON.parse(messageEvent.data) as { from_line: number; entries: LogEntry[] };
      setLogEntries((previousEntries) => [...previousEntries.slice(0, logChunk.from_line), ...logChunk.entries]);
    };

    /** Store the latest status snapshot. */
    const handleStatusEvent = (messageEvent: MessageEvent<string>) => {
      setJobSummary(JSON.parse(messageEvent.data) as JobSummary);
    };

    /** Close the stream and notify the caller once the job has ended. */
    const handleEndEvent = (messageEvent: MessageEvent<string>) => {
      const finishedJob = JSON.parse(messageEvent.data) as JobSummary;
      setJobSummary(finishedJob);
      eventSource.close();
      if (!finishedNotified) {
        finishedNotified = true;
        finishedCallbackRef.current?.(finishedJob);
      }
    };

    /** Report a lost connection (the browser retries on its own). */
    const handleConnectionError = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setConnectionError("Se perdió la conexión con el servidor");
      }
    };

    eventSource.addEventListener("log", handleLogEvent as EventListener);
    eventSource.addEventListener("status", handleStatusEvent as EventListener);
    eventSource.addEventListener("end", handleEndEvent as EventListener);
    eventSource.addEventListener("error", handleConnectionError);
    return () => eventSource.close();
  }, [jobId]);

  return {
    jobSummary,
    logEntries,
    isFinished: jobSummary !== null && FINISHED_JOB_STATUSES.includes(jobSummary.status),
    connectionError,
  };
}

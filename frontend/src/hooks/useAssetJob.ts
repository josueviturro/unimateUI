import { useEffect, useState } from "react";
import { apiClient } from "../api/api_client";

const JOB_LOOKUP_POLL_MILLISECONDS = 2000;

/**
 * Id of the unfinished job working on a character (e.g. after navigating away and back).
 * Polls only while `isProcessing` is true.
 */
export function useAssetJob(assetName: string | null, isProcessing: boolean): string | null {
  const [foundJobId, setFoundJobId] = useState<string | null>(null);

  useEffect(() => {
    setFoundJobId(null);
    if (!assetName || !isProcessing) return undefined;
    let isCancelled = false;

    /** Ask the backend for the newest unfinished job tied to this character. */
    const lookUpJob = async () => {
      try {
        const sessionJobs = await apiClient.fetchJobs();
        const matchingJob = sessionJobs.find((sessionJob) =>
          sessionJob.related.asset === assetName && (sessionJob.status === "running" || sessionJob.status === "queued"));
        if (!isCancelled && matchingJob) setFoundJobId(matchingJob.job_id);
      } catch {
        // the next poll retries
      }
    };

    void lookUpJob();
    const pollTimer = window.setInterval(() => void lookUpJob(), JOB_LOOKUP_POLL_MILLISECONDS);
    return () => {
      isCancelled = true;
      window.clearInterval(pollTimer);
    };
  }, [assetName, isProcessing]);

  return foundJobId;
}

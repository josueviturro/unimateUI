// Thin typed wrappers around every backend endpoint.

import type {
  Annotation,
  AnnotationFacePair,
  AssetInfo,
  GenerateRequest,
  GenerateResponse,
  JobStartedResponse,
  JobSummary,
  LogEntry,
  RunDetail,
  RunSummary,
  StorageSummary,
  SystemHealth,
  UploadResponse,
} from "./api_types";

/** Error carrying the backend's "detail" message so the UI can show it as is. */
export class ApiError extends Error {
  statusCode: number;

  /** Build an error from an HTTP status and the backend's message. */
  constructor(statusCode: number, detailMessage: string) {
    super(detailMessage);
    this.statusCode = statusCode;
  }
}

/** Fetch JSON from the backend and throw ApiError with the backend message on failure. */
async function requestJson<ResponseShape>(requestPath: string, requestOptions: RequestInit = {}): Promise<ResponseShape> {
  const response = await fetch(requestPath, requestOptions);
  if (!response.ok) {
    let detailMessage = `Error ${response.status}`;
    try {
      const errorBody = await response.json();
      detailMessage = typeof errorBody.detail === "string" ? errorBody.detail : JSON.stringify(errorBody.detail);
    } catch {
      // keep the generic message when the body is not JSON
    }
    throw new ApiError(response.status, detailMessage);
  }
  return response.json() as Promise<ResponseShape>;
}

/** Send a JSON body with the given HTTP method. */
function sendJson<ResponseShape>(requestPath: string, httpMethod: string, requestBody?: unknown): Promise<ResponseShape> {
  return requestJson<ResponseShape>(requestPath, {
    method: httpMethod,
    headers: { "Content-Type": "application/json" },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  });
}

export const apiClient = {
  /** GPU, VRAM, model status, ComfyUI presence and the running job. */
  fetchHealth: () => requestJson<SystemHealth>("/api/health"),

  /** Every character (user uploads and repo examples). */
  fetchAssets: () => requestJson<AssetInfo[]>("/api/assets"),

  /** Upload a GLB/FBX and start the bone labelling (review) job. */
  uploadAsset: (modelFile: File, displayName: string) => {
    const formData = new FormData();
    formData.append("model_file", modelFile);
    if (displayName) formData.append("display_name", displayName);
    return requestJson<UploadResponse>("/api/assets", { method: "POST", body: formData });
  },

  /** Delete a user character. */
  deleteAsset: (assetName: string) => sendJson<{ deleted: string }>(`/api/assets/${assetName}`, "DELETE"),

  /** Joint labels and facing pair of a character. */
  fetchAnnotation: (assetName: string) => requestJson<Annotation>(`/api/assets/${assetName}/annotation`),

  /** Save edited joint labels and facing pair. */
  saveAnnotation: (assetName: string, facePair: Pick<AnnotationFacePair, "right" | "left" | "body_axis">,
    jointLabels: { raw: string; label: string }[]) =>
    sendJson<Annotation>(`/api/assets/${assetName}/annotation`, "PUT", { face_pair: facePair, joints: jointLabels }),

  /** Re-run the review with a rest-pose rotation (e.g. "x90"). */
  applyRestRotation: (assetName: string, restRotation: string) =>
    sendJson<JobStartedResponse>(`/api/assets/${assetName}/rotation`, "POST", { rest_rotation: restRotation }),

  /** Build cond.npy + canonical GLB from the reviewed annotation. */
  buildAsset: (assetName: string) => sendJson<JobStartedResponse>(`/api/assets/${assetName}/build`, "POST"),

  /** Start a generation run. */
  generate: (generateRequest: GenerateRequest) => sendJson<GenerateResponse>("/api/generate", "POST", generateRequest),

  /** History rows, newest first. */
  fetchRuns: () => requestJson<RunSummary[]>("/api/runs"),

  /** Disk used by all runs. */
  fetchStorage: () => requestJson<StorageSummary>("/api/runs/storage"),

  /** One run with its cases and variants. */
  fetchRunDetail: (runName: string) => requestJson<RunDetail>(`/api/runs/${runName}`),

  /** Mark or unmark a variant as favorite. */
  setFavorite: (runName: string, sampleStem: string, isFavorite: boolean) =>
    sendJson<{ favorites: string[] }>(`/api/runs/${runName}/favorites`, "PUT", { sample_stem: sampleStem, favorite: isFavorite }),

  /** Export GLB/FBX for a run (canonical or original scale). */
  animateRun: (runName: string, useOriginalScale: boolean) =>
    sendJson<JobStartedResponse>(`/api/runs/${runName}/animate`, "POST", { original_scale: useOriginalScale }),

  /** Same parameters as an earlier run, new seed. */
  relaunchRun: (runName: string) => sendJson<GenerateResponse>(`/api/runs/${runName}/relaunch`, "POST"),

  /** More variants of one case: same prompt and character, new seed. */
  generateSimilar: (runName: string, caseId: string) =>
    sendJson<GenerateResponse>(`/api/runs/${runName}/similar`, "POST", { case_id: caseId }),

  /** Delete a run folder. */
  deleteRun: (runName: string) => sendJson<{ deleted: string }>(`/api/runs/${runName}`, "DELETE"),

  /** URL of the ZIP with every exported file of a run. */
  buildRunZipUrl: (runName: string, exportScale: "canonical" | "original") => `/api/runs/${runName}/zip?scale=${exportScale}`,

  /** Jobs of this backend session, newest first. */
  fetchJobs: () => requestJson<JobSummary[]>("/api/jobs"),

  /** Status plus full log of one job. */
  fetchJob: (jobId: string) => requestJson<JobSummary & { log: LogEntry[] }>(`/api/jobs/${jobId}`),

  /** Cancel a queued or running job. */
  cancelJob: (jobId: string) => sendJson<{ cancelled: boolean }>(`/api/jobs/${jobId}/cancel`, "POST"),

  /** URL of the Server-Sent Events stream of a job. */
  buildJobEventsUrl: (jobId: string) => `/api/jobs/${jobId}/events`,
};

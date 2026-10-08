// Shapes of the JSON returned by the FastAPI backend (UI/backend).

export type AssetStatus = "processing" | "review" | "ready" | "too_many_joints" | "failed" | "empty";

export interface GpuInfo {
  name: string;
  vram_used_gb: number;
  vram_total_gb: number;
  vram_free_gb: number;
}

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobSummary {
  job_id: string;
  kind: string;
  title: string;
  status: JobStatus;
  phase: string;
  progress: number | null;
  related: { asset?: string; run?: string };
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  current_step: number;
  total_steps: number;
  error_message: string | null;
  log_line_count: number;
}

export interface LogEntry {
  time: string;
  text: string;
  level: "info" | "warning" | "error" | "success" | "step" | "command";
}

export interface SystemHealth {
  model_label: string;
  model_ready: boolean;
  venv_ready: boolean;
  git_bash_ready: boolean;
  gpu: GpuInfo | null;
  comfyui_running: boolean;
  limits: { max_joints: number; clip_frames: number; clip_fps: number };
  active_job: JobSummary | null;
  queued_job_count: number;
}

export interface AssetInfo {
  name: string;
  display_name: string;
  origin: "example" | "user";
  editable: boolean;
  status: AssetStatus;
  joint_count: number | null;
  max_joints: number;
  fits_model: boolean;
  flagged_joints: number;
  notes: string[];
  last_error: string | null;
  source_extension: string | null;
  has_source_file: boolean;
  rest_rotation: string;
  preview_url: string | null;
  annotation_preview_url: string | null;
  canonical_glb_url: string | null;
  asset_reference: string;
}

export interface AnnotationJoint {
  index: number;
  raw: string;
  parent: string | null;
  label: string;
  source: string;
  check: boolean;
  reasons?: string[];
}

export interface AnnotationFacePair {
  right: string;
  left: string;
  body_axis: boolean;
  source: string;
  check: boolean;
  reasons?: string[];
}

export interface Annotation {
  asset: string;
  notes: string[];
  face_pair: AnnotationFacePair;
  face_pair_alternatives: [string, string, string][];
  n_flagged: number;
  joints: AnnotationJoint[];
  vocabulary?: { format: string; parts: string[] };
}

export type RunStatus = "running" | "completed" | "not_animated" | "failed" | "cancelled";
export type GenerationMode = "text" | "expand";

export interface RunSummary {
  run_name: string;
  created_at: number;
  assets: string[];
  prompts: string[];
  mode: GenerationMode;
  repetitions: number | null;
  cfg_scale: number | null;
  seed: number | null;
  status: RunStatus;
  sample_count: number;
  favorite_count: number;
  job_id: string | null;
  error_message: string | null;
}

export type ExportScale = "canonical" | "original";

export interface LoopSettings {
  min_cycle_seconds: number;
  blend_frames: number;
  in_place: boolean;
}

export interface LoopReport {
  start_frame: number;
  end_frame: number;
  loop_frames: number;
  loop_seconds: number;
  blend_frames: number;
  in_place: boolean;
  seam_error_original_clip: number;
  seam_error_chosen_cut: number;
  settings?: LoopSettings;
}

export interface RunVariant {
  sample_stem: string;
  repetition_index: number;
  seed: number | null;
  cfg_scale: number | null;
  preview_video_url: string | null;
  canonical_glb_url: string | null;
  canonical_fbx_url: string | null;
  original_glb_url: string | null;
  original_fbx_url: string | null;
  canonical_loop_glb_url: string | null;
  canonical_loop_fbx_url: string | null;
  canonical_loop_report: LoopReport | null;
  original_loop_glb_url: string | null;
  original_loop_fbx_url: string | null;
  original_loop_report: LoopReport | null;
  favorite: boolean;
}

export interface RunCase {
  case_id: string;
  asset: string;
  prompt: string;
  variants: RunVariant[];
}

export interface RunDetail extends RunSummary {
  cases: RunCase[];
}

export interface StorageSummary {
  total_bytes: number;
  run_count: number;
  exported_file_count: number;
}

export interface GenerateRequest {
  assets: string[];
  prompts: string[];
  repetitions: number;
  cfg_scale: number;
  seed: number | null;
  mode: GenerationMode;
  expand_overlap?: number;
  export_meshes: boolean;
}

export interface JobStartedResponse {
  job_id: string;
}

export interface GenerateResponse extends JobStartedResponse {
  run_name: string;
  seed: number;
}

export interface UploadResponse extends JobStartedResponse {
  asset_name: string;
}

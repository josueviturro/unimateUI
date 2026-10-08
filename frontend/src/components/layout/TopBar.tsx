import { useStudio } from "../../state/StudioContext";
import { ProgressBar } from "../common/ProgressBar";
import { StatusPill } from "../common/StatusPill";
import styles from "./TopBar.module.css";

/** Persistent header: brand, model status, GPU/VRAM, ComfyUI warning, license and running job. */
export function TopBar() {
  const { systemHealth, healthErrorMessage, showView } = useStudio();
  const gpuInfo = systemHealth?.gpu ?? null;
  const vramUsedFraction = gpuInfo ? gpuInfo.vram_used_gb / gpuInfo.vram_total_gb : 0;
  const activeJob = systemHealth?.active_job ?? null;

  /** Open the screen where the running job is shown. */
  const handleActiveJobClick = () => {
    if (!activeJob) return;
    showView(activeJob.related.run ? "generator" : "review");
  };

  return (
    <header className={styles.bar_top_application}>
      <div className={styles.container_brand}>
        <span className={styles.icon_brand_logo} aria-hidden="true">◈</span>
        <span className={styles.text_brand_name}>UniMate Studio</span>
        <span className={styles.badge_license} title="Los checkpoints de UniMate son CC BY-NC 4.0: no se pueden usar con fines comerciales">
          NO COMERCIAL · CC BY-NC 4.0
        </span>
      </div>

      <div className={styles.container_system_indicators}>
        {healthErrorMessage && !systemHealth && (
          <StatusPill tone="danger">Backend desconectado</StatusPill>
        )}

        {systemHealth?.comfyui_running && (
          <div className={styles.container_comfyui_warning} role="status">
            ⚠ ComfyUI abierto — usando {gpuInfo ? `${gpuInfo.vram_used_gb.toFixed(1)} GB` : "VRAM"}. Puede faltar memoria para generar.
          </div>
        )}

        {activeJob && (
          <button type="button" className={styles.button_active_job} onClick={handleActiveJobClick}>
            <StatusPill tone="info" isPulsing>
              {activeJob.phase} {activeJob.progress !== null ? `${Math.round(activeJob.progress * 100)}%` : ""}
            </StatusPill>
            {systemHealth && systemHealth.queued_job_count > 0 && (
              <span className={styles.text_queue_count}>+{systemHealth.queued_job_count} en cola</span>
            )}
          </button>
        )}

        {systemHealth && (
          <StatusPill tone={systemHealth.model_ready ? "success" : "danger"}>
            {systemHealth.model_label} {systemHealth.model_ready ? "[Listo]" : "[Falta checkpoint]"}
          </StatusPill>
        )}

        {gpuInfo && (
          <div className={styles.container_vram_meter} title={`${gpuInfo.vram_free_gb.toFixed(1)} GB libres`}>
            <div className={styles.row_vram_labels}>
              <span>{gpuInfo.name}</span>
              <span>
                VRAM {gpuInfo.vram_used_gb.toFixed(1)} / {gpuInfo.vram_total_gb.toFixed(0)} GB
                <span className={styles.text_vram_free}> · {gpuInfo.vram_free_gb.toFixed(1)} libres</span>
              </span>
            </div>
            <ProgressBar progressFraction={vramUsedFraction} sizeVariant="thin" tone="vram" />
          </div>
        )}
      </div>
    </header>
  );
}

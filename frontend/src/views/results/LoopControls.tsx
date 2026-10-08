import { useState } from "react";
import { apiClient } from "../../api/api_client";
import type { ExportScale, JobSummary, LoopReport, LoopSettings } from "../../api/api_types";
import { ActionButton } from "../../components/common/ActionButton";
import { ProgressBar } from "../../components/common/ProgressBar";
import { SliderField } from "../../components/common/SliderField";
import { useJobStream } from "../../hooks/useJobStream";
import styles from "./LoopControls.module.css";

const DEFAULT_LOOP_SETTINGS: LoopSettings = { min_cycle_seconds: 0.8, blend_frames: 12, in_place: true };

interface LoopControlsProps {
  runName: string;
  sampleStem: string;
  exportScale: ExportScale;
  existingReport: LoopReport | null;
  isSourceExported: boolean;
  onLoopReady: () => void;
}

/** Settings form and job status to turn one variant into a seamless loop. */
export function LoopControls({ runName, sampleStem, exportScale, existingReport, isSourceExported, onLoopReady }: LoopControlsProps) {
  const [loopSettings, setLoopSettings] = useState<LoopSettings>(existingReport?.settings ?? DEFAULT_LOOP_SETTINGS);
  const [loopJobId, setLoopJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Show the job error, or refresh the run when the loop is ready. */
  const handleLoopJobFinished = (finishedJob: JobSummary) => {
    setLoopJobId(null);
    if (finishedJob.status === "completed") onLoopReady();
    else setErrorMessage(finishedJob.error_message ?? "No se pudo crear el loop");
  };
  const { jobSummary } = useJobStream(loopJobId, handleLoopJobFinished);

  /** Change one setting of the form. */
  const updateSetting = <SettingName extends keyof LoopSettings>(settingName: SettingName, settingValue: LoopSettings[SettingName]) => {
    setLoopSettings((previousSettings) => ({ ...previousSettings, [settingName]: settingValue }));
  };

  /** Start the loop job on the backend's CPU queue. */
  const handleCreateClick = async () => {
    setErrorMessage(null);
    try {
      const loopResponse = await apiClient.createLoop(runName, sampleStem, exportScale, loopSettings);
      setLoopJobId(loopResponse.job_id);
    } catch (createError) {
      setErrorMessage(createError instanceof Error ? createError.message : String(createError));
    }
  };

  const isWorking = loopJobId !== null;

  return (
    <div className={styles.panel_loop_controls}>
      <label className={styles.label_in_place}>
        <input type="checkbox" checked={loopSettings.in_place} disabled={isWorking}
          onChange={(changeEvent) => updateSetting("in_place", changeEvent.target.checked)} />
        En el lugar (sin avanzar)
      </label>
      <SliderField label="Ciclo mínimo" value={loopSettings.min_cycle_seconds} minimumValue={0.4} maximumValue={1.6}
        stepSize={0.1} valueSuffix=" s" onValueChange={(nextValue) => updateSetting("min_cycle_seconds", nextValue)}
        scaleHints={["0.4 s", "corto = más repetitivo", "1.6 s"]} />
      <SliderField label="Fundido de la unión" value={loopSettings.blend_frames} minimumValue={4} maximumValue={20}
        stepSize={1} valueSuffix=" fr" accentTone="secondary" onValueChange={(nextValue) => updateSetting("blend_frames", nextValue)}
        scaleHints={["4 (seco)", "", "20 (suave)"]} />

      {isWorking ? (
        <div className={styles.container_loop_progress}>
          <span className={styles.text_loop_phase}>{jobSummary?.phase ?? "En cola…"}</span>
          <ProgressBar progressFraction={null} sizeVariant="thin" />
        </div>
      ) : (
        <ActionButton variant="primary" size="small" iconSymbol="⟲" isFullWidth onClick={handleCreateClick} disabled={!isSourceExported}>
          {existingReport ? "Rehacer loop" : "Crear loop"}
        </ActionButton>
      )}
      {!isSourceExported && <p className={styles.text_loop_hint}>Primero exportá esta variante a GLB.</p>}
      {errorMessage && <p className={styles.text_loop_error}>{errorMessage}</p>}
      {existingReport && !isWorking && (
        <p className={styles.text_loop_hint}>
          Ciclo actual: frames {existingReport.start_frame}–{existingReport.end_frame} ({existingReport.loop_seconds} s)
          {existingReport.in_place ? " · en el lugar" : ""}
        </p>
      )}
    </div>
  );
}

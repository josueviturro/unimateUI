import { useEffect, useState } from "react";
import { apiClient } from "../../api/api_client";
import type { GenerationMode, JobSummary } from "../../api/api_types";
import { ActionButton } from "../../components/common/ActionButton";
import { InlineMessage } from "../../components/common/InlineMessage";
import { PanelSection } from "../../components/common/PanelSection";
import { SliderField } from "../../components/common/SliderField";
import { StatusPill } from "../../components/common/StatusPill";
import { JobProgressPanel } from "../../components/jobs/JobProgressPanel";
import { useStudio } from "../../state/StudioContext";
import layoutStyles from "../../styles/view_layout.module.css";
import { buildFullPrompt } from "../../utils/prompt_rules";
import { CharacterPicker } from "./CharacterPicker";
import { PromptComposer } from "./PromptComposer";
import styles from "./GeneratorView.module.css";

const DEFAULT_REPETITIONS = 3;
const DEFAULT_CFG_SCALE = 3;
const MAX_RANDOM_SEED = 2 ** 31 - 1;
const LOW_VRAM_WARNING_GB = 3;

/** Screen 3: pick characters, write the action, tune variants/CFG/seed and run the generation. */
export function GeneratorView() {
  const { assets, activeAsset, systemHealth, activeGeneration, setActiveGeneration, openRunResults, reloadAssets } = useStudio();
  const readyAssets = assets.filter((assetItem) => assetItem.status === "ready");
  const [selectedAssetNames, setSelectedAssetNames] = useState<string[]>([]);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("text");
  const [actionTexts, setActionTexts] = useState<string[]>(["walks forward", ""]);
  const [repetitions, setRepetitions] = useState(DEFAULT_REPETITIONS);
  const [cfgScale, setCfgScale] = useState(DEFAULT_CFG_SCALE);
  const [seedText, setSeedText] = useState("");
  const [shouldExportMeshes, setShouldExportMeshes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const [finishedJob, setFinishedJob] = useState<JobSummary | null>(null);
  const [lastUsedSeed, setLastUsedSeed] = useState<number | null>(null);

  useEffect(() => {
    // preselect the active character when it is ready and nothing is selected yet
    if (selectedAssetNames.length === 0 && activeAsset?.status === "ready") {
      setSelectedAssetNames([activeAsset.name]);
    }
  }, [activeAsset, selectedAssetNames.length]);

  const promptsToSend = generationMode === "expand"
    ? actionTexts.filter((actionText) => actionText.trim())
    : actionTexts.slice(0, 1).filter((actionText) => actionText.trim());
  const isSeedValid = seedText.trim() === "" || /^\d{1,10}$/.test(seedText.trim());
  const isJobRunning = activeGeneration !== null && finishedJob === null;
  const canGenerate = selectedAssetNames.length > 0 && isSeedValid && !isSubmitting && !isJobRunning
    && (generationMode === "expand" ? promptsToSend.length >= 2 : promptsToSend.length === 1);
  const freeVramGb = systemHealth?.gpu?.vram_free_gb ?? null;

  /** Send the generation request and start following its job. */
  const handleGenerateClick = async () => {
    setIsSubmitting(true);
    setSubmitErrorMessage(null);
    setFinishedJob(null);
    try {
      const generateResponse = await apiClient.generate({
        assets: selectedAssetNames,
        prompts: promptsToSend.map(buildFullPrompt),
        repetitions,
        cfg_scale: cfgScale,
        seed: seedText.trim() ? Number(seedText.trim()) : null,
        mode: generationMode,
        export_meshes: shouldExportMeshes,
      });
      setActiveGeneration({ jobId: generateResponse.job_id, runName: generateResponse.run_name });
      setLastUsedSeed(generateResponse.seed);
    } catch (generateError) {
      setSubmitErrorMessage(generateError instanceof Error ? generateError.message : String(generateError));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Remember how the job ended to show the "see results" action. */
  const handleJobFinished = (endedJob: JobSummary) => {
    setFinishedJob(endedJob);
    void reloadAssets();
  };

  /** Switch Normal / Chained, keeping at least two slots for chains. */
  const handleModeChange = (nextMode: GenerationMode) => {
    setGenerationMode(nextMode);
    if (nextMode === "expand" && actionTexts.length < 2) setActionTexts([...actionTexts, ""]);
  };

  return (
    <div className={layoutStyles.container_general_view}>
      <div className={layoutStyles.container_view_content}>
        <header className={layoutStyles.header_view}>
          <div>
            <h1 className={layoutStyles.text_view_title}>
              Generador de animaciones{" "}
              <StatusPill tone={systemHealth?.model_ready ? "success" : "danger"}>
                {systemHealth?.model_ready ? "Motor listo" : "Falta el modelo"}
              </StatusPill>
            </h1>
            <p className={layoutStyles.text_view_subtitle}>Movimiento 3D a partir de texto para los esqueletos elegidos.</p>
          </div>
          <div className={layoutStyles.container_view_header_extra}>
            <span className={layoutStyles.badge_view_info}>
              ⏱ Cada clip: <span className={layoutStyles.text_badge_highlight}>2 s · 60 frames · 30 fps</span>
            </span>
            {freeVramGb !== null && (
              <span className={layoutStyles.badge_view_info}>
                VRAM libre: <span className={layoutStyles.text_badge_highlight}>{freeVramGb.toFixed(1)} GB</span>
              </span>
            )}
          </div>
        </header>

        {freeVramGb !== null && freeVramGb < LOW_VRAM_WARNING_GB && (
          <InlineMessage tone="warning" title="Poca VRAM libre">
            Quedan {freeVramGb.toFixed(1)} GB. Cerrá ComfyUI, Unreal u otros programas que usen la GPU antes de generar.
          </InlineMessage>
        )}

        <div className={styles.grid_generator_columns}>
          <CharacterPicker readyAssets={readyAssets} selectedAssetNames={selectedAssetNames} onSelectionChange={setSelectedAssetNames} />

          <PanelSection
            title="Configuración de animación"
            iconSymbol="☰"
            headerExtra={
              <div className={styles.container_mode_toggle} role="tablist">
                <button type="button" role="tab" aria-selected={generationMode === "text"}
                  className={`${styles.button_mode_option} ${generationMode === "text" ? styles.button_mode_active : ""}`}
                  onClick={() => handleModeChange("text")}>
                  ▶ Modo Normal (1 clip)
                </button>
                <button type="button" role="tab" aria-selected={generationMode === "expand"}
                  className={`${styles.button_mode_option} ${generationMode === "expand" ? styles.button_mode_active : ""}`}
                  onClick={() => handleModeChange("expand")}>
                  ⛓ Modo Encadenado
                </button>
              </div>
            }
          >
            <div className={styles.container_configuration_body}>
              <p className={styles.text_mode_explanation}>
                {generationMode === "text"
                  ? "Modo Normal: genera un clip de 2 s para la acción, por cada personaje elegido."
                  : "Modo Encadenado: une varias acciones en un solo movimiento largo (cada tramo se superpone 10 frames con el anterior)."}
              </p>

              <PromptComposer generationMode={generationMode} actionTexts={actionTexts} onActionTextsChange={setActionTexts} />

              <div className={styles.grid_generation_parameters}>
                <div className={styles.card_generation_parameter}>
                  <SliderField label="Variantes" value={repetitions} minimumValue={1} maximumValue={5} stepSize={1}
                    onValueChange={setRepetitions} scaleHints={["1 versión", "Recomendado: 3", "5 máx."]} />
                </div>
                <div className={styles.card_generation_parameter}>
                  <SliderField label="Fuerza del prompt (CFG)" value={cfgScale} minimumValue={1} maximumValue={7} stepSize={0.5}
                    onValueChange={setCfgScale} accentTone="secondary" scaleHints={["1 Suave", "Default 3", "7 Estricto"]} />
                </div>
                <div className={styles.card_generation_parameter}>
                  <div className={styles.row_seed_header}>
                    <label className={styles.text_seed_label} htmlFor="seed_input">Semilla</label>
                    <span className={styles.text_seed_optional}>opcional</span>
                  </div>
                  <div className={styles.row_seed_input}>
                    <input id="seed_input" className={`${styles.input_seed_value} ${isSeedValid ? "" : styles.input_seed_invalid}`}
                      value={seedText} placeholder="aleatoria" inputMode="numeric"
                      onChange={(changeEvent) => setSeedText(changeEvent.target.value)} />
                    <ActionButton size="small" title="Semilla al azar"
                      onClick={() => setSeedText(String(Math.floor(Math.random() * MAX_RANDOM_SEED)))}>⚄</ActionButton>
                    <ActionButton size="small" variant="ghost" title="Vaciar (aleatoria)" onClick={() => setSeedText("")}>×</ActionButton>
                  </div>
                  <span className={styles.text_seed_hint}>Vacía = aleatoria. La misma semilla repite el resultado.</span>
                </div>
              </div>

              <div className={styles.row_generate_footer}>
                <label className={styles.label_export_meshes}>
                  <input type="checkbox" checked={shouldExportMeshes} onChange={(changeEvent) => setShouldExportMeshes(changeEvent.target.checked)} />
                  Exportar GLB/FBX al terminar
                </label>
                <ActionButton variant="primary" size="large" iconSymbol="▶" onClick={handleGenerateClick} disabled={!canGenerate}>
                  {isSubmitting ? "Enviando…" : "Generar animación"}
                </ActionButton>
              </div>
              {submitErrorMessage && <InlineMessage tone="danger" title="No se pudo iniciar">{submitErrorMessage}</InlineMessage>}
            </div>
          </PanelSection>
        </div>

        {activeGeneration && (
          <>
            <JobProgressPanel jobId={activeGeneration.jobId} title={`Progreso en vivo: ${activeGeneration.runName}${lastUsedSeed !== null ? ` · semilla ${lastUsedSeed}` : ""}`}
              onFinished={handleJobFinished} />
            {finishedJob?.status === "completed" && (
              <InlineMessage tone="success" title="Tanda lista"
                actions={<ActionButton variant="primary" onClick={() => openRunResults(activeGeneration.runName)}>Ver resultados →</ActionButton>}>
                Los movimientos están generados{shouldExportMeshes ? " y exportados a GLB/FBX" : ""}.
              </InlineMessage>
            )}
          </>
        )}
      </div>
    </div>
  );
}

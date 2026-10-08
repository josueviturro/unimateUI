import { useEffect, useState } from "react";
import { apiClient } from "../../api/api_client";
import type { RunDetail, RunVariant } from "../../api/api_types";
import { ActionButton, LinkButton } from "../../components/common/ActionButton";
import { InlineMessage } from "../../components/common/InlineMessage";
import { StatusPill } from "../../components/common/StatusPill";
import { JobProgressPanel } from "../../components/jobs/JobProgressPanel";
import { useApiResource } from "../../hooks/useApiResource";
import { useStudio } from "../../state/StudioContext";
import layoutStyles from "../../styles/view_layout.module.css";
import { describeRunStatus, formatRunDate } from "../../utils/formatters";
import { CaseSimilarButton, VariantCard, type ExportScale } from "./VariantCard";
import styles from "./ResultsView.module.css";

const VARIANT_LETTERS = "ABCDEFGHIJ";

/** True when every variant of the run already has a file at the given scale. */
function hasExportAtScale(runDetail: RunDetail, exportScale: ExportScale): boolean {
  const allVariants = runDetail.cases.flatMap((caseEntry) => caseEntry.variants);
  return allVariants.length > 0 && allVariants.every((variantItem) =>
    exportScale === "original" ? variantItem.original_glb_url : variantItem.canonical_glb_url);
}

/** Screen 4: compare the variants of a run, mark favorites, export and download. */
export function ResultsView() {
  const { selectedRunName, openRunResults, assets, setActiveGeneration, showView } = useStudio();
  const runsResource = useApiResource(apiClient.fetchRuns, "runs");
  const effectiveRunName = selectedRunName ?? runsResource.data?.[0]?.run_name ?? null;
  const runResource = useApiResource(
    () => (effectiveRunName ? apiClient.fetchRunDetail(effectiveRunName) : Promise.resolve(null)),
    `run-${effectiveRunName}`,
  );
  const runDetail = runResource.data;
  const [exportScale, setExportScale] = useState<ExportScale>("canonical");
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setExportJobId(null);
    setActionErrorMessage(null);
    setExportScale("canonical");
  }, [effectiveRunName]);

  const runAsset = runDetail && runDetail.assets.length === 1
    ? assets.find((assetItem) => assetItem.name === runDetail.assets[0]) ?? null : null;
  const canUseOriginalScale = runAsset !== null && runAsset.origin === "user" && runAsset.has_source_file;
  const hasRequestedExport = runDetail ? hasExportAtScale(runDetail, exportScale) : false;

  /** Run an API call and show its error message if it fails. */
  const runAction = async (actionToRun: () => Promise<void>) => {
    setActionErrorMessage(null);
    try {
      await actionToRun();
    } catch (actionError) {
      setActionErrorMessage(actionError instanceof Error ? actionError.message : String(actionError));
    }
  };

  /** Flip a variant's favorite flag and refresh the run. */
  const handleToggleFavorite = (variantItem: RunVariant) => runAction(async () => {
    if (!effectiveRunName) return;
    await apiClient.setFavorite(effectiveRunName, variantItem.sample_stem, !variantItem.favorite);
    await runResource.reload();
  });

  /** Export GLB/FBX at the selected scale. */
  const handleExportClick = () => runAction(async () => {
    if (!effectiveRunName) return;
    const exportResponse = await apiClient.animateRun(effectiveRunName, exportScale === "original");
    setExportJobId(exportResponse.job_id);
  });

  /** New run with the same prompt and character, new seed; follow it in the generator. */
  const handleSimilarClick = (caseId: string) => runAction(async () => {
    if (!effectiveRunName) return;
    const generateResponse = await apiClient.generateSimilar(effectiveRunName, caseId);
    setActiveGeneration({ jobId: generateResponse.job_id, runName: generateResponse.run_name });
    showView("generator");
  });

  if (!runsResource.isLoading && !effectiveRunName) {
    return (
      <div className={layoutStyles.container_view_content}>
        <div className={layoutStyles.container_empty_state}>
          <h1 className={layoutStyles.text_empty_state_title}>Todavía no hay tandas</h1>
          <p>Generá tu primera animación en la pantalla 3.</p>
          <ActionButton variant="primary" onClick={() => showView("generator")}>Ir al Generador</ActionButton>
        </div>
      </div>
    );
  }

  const runStatus = runDetail ? describeRunStatus(runDetail.status) : null;
  const variantCount = runDetail?.cases.reduce((countSoFar, caseEntry) => countSoFar + caseEntry.variants.length, 0) ?? 0;

  return (
    <div className={layoutStyles.container_general_view}>
      <div className={layoutStyles.container_view_content}>
        <header className={styles.header_run_results}>
          <span className={styles.icon_run_results} aria-hidden="true">◎</span>
          <div className={styles.container_run_title}>
            <div className={styles.row_run_title}>
              <span className={styles.badge_run_name}>{effectiveRunName}</span>
              <h1 className={styles.text_run_title}>
                {runDetail ? `${runDetail.assets.join(", ")}: ${runDetail.prompts.join(" / ")}` : "Cargando…"}
              </h1>
              {runDetail && <span className={styles.badge_variant_count}>{variantCount} variantes</span>}
              {runStatus && <StatusPill tone={runStatus.tone}>{runStatus.label}</StatusPill>}
            </div>
            {runDetail && (
              <p className={styles.text_run_meta}>
                Modelo: UniMate v3 · {runDetail.mode === "expand" ? "Encadenado" : "2.0 s (60 frames)"} · {formatRunDate(runDetail.created_at)}
              </p>
            )}
          </div>
          <label className={styles.label_run_selector}>
            Tanda:
            <select className={styles.select_run} value={effectiveRunName ?? ""}
              onChange={(changeEvent) => openRunResults(changeEvent.target.value)}>
              {(runsResource.data ?? []).map((runRow) => (
                <option key={runRow.run_name} value={runRow.run_name}>
                  {runRow.run_name} · {runRow.prompts[0] ?? ""}
                </option>
              ))}
            </select>
          </label>
        </header>

        {actionErrorMessage && <InlineMessage tone="danger">{actionErrorMessage}</InlineMessage>}
        {runResource.errorMessage && <InlineMessage tone="danger">{runResource.errorMessage}</InlineMessage>}
        {runDetail?.status === "failed" && runDetail.error_message && (
          <InlineMessage tone="danger" title="La tanda terminó con error">{runDetail.error_message}</InlineMessage>
        )}

        {runDetail?.cases.map((caseEntry) => (
          <section key={caseEntry.case_id} className={styles.section_run_case}>
            <div className={styles.header_run_case}>
              <h2 className={styles.text_case_title}>
                <span className={styles.text_case_asset}>{caseEntry.asset}</span> “{caseEntry.prompt}”
              </h2>
              <CaseSimilarButton isDisabled={runDetail.status === "running"} onClick={() => handleSimilarClick(caseEntry.case_id)} />
            </div>
            <div className={styles.grid_variant_cards}>
              {caseEntry.variants.map((variantItem, variantIndex) => (
                <VariantCard key={variantItem.sample_stem} variantLetter={VARIANT_LETTERS[variantIndex] ?? String(variantIndex + 1)}
                  variant={variantItem} prompt={caseEntry.prompt} exportScale={exportScale} onToggleFavorite={handleToggleFavorite} />
              ))}
            </div>
          </section>
        ))}

        {exportJobId && (
          <JobProgressPanel jobId={exportJobId} title="Exportando GLB/FBX" consoleHeight="compact"
            onFinished={() => void runResource.reload()} />
        )}
      </div>

      {runDetail && (
        <footer className={layoutStyles.bar_view_footer}>
          <div className={styles.container_export_settings}>
            <span className={styles.text_export_caption}>Exportación:</span>
            <div className={styles.container_scale_toggle} role="tablist">
              <button type="button" role="tab" aria-selected={exportScale === "canonical"}
                className={`${styles.button_scale_option} ${exportScale === "canonical" ? styles.button_scale_active : ""}`}
                onClick={() => setExportScale("canonical")}>
                Canónico
              </button>
              <button type="button" role="tab" aria-selected={exportScale === "original"} disabled={!canUseOriginalScale}
                title={canUseOriginalScale ? "Anima tu archivo original (experimental)" : "Solo para tandas de un personaje subido por vos"}
                className={`${styles.button_scale_option} ${exportScale === "original" ? styles.button_scale_active : ""}`}
                onClick={() => setExportScale("original")}>
                Escala y orientación originales
              </button>
            </div>
            <span className={styles.text_export_hint}>
              {exportScale === "canonical"
                ? "Canónico: centrado, diámetro 2, mirando a +Z (reescalar en Unreal)."
                : "Experimental: anima tu archivo subido; puede fallar si tiene huesos extra."}
            </span>
          </div>
          <div className={styles.container_export_actions}>
            {!hasRequestedExport && (
              <ActionButton variant="secondary" iconSymbol="⚙" onClick={handleExportClick}
                disabled={runDetail.status === "running" || Boolean(exportJobId)}>
                Exportar GLB/FBX {exportScale === "original" ? "(original)" : ""}
              </ActionButton>
            )}
            <LinkButton variant="primary" iconSymbol="⤓"
              href={hasRequestedExport && effectiveRunName ? apiClient.buildRunZipUrl(effectiveRunName, exportScale) : null}>
              Descargar tanda (.ZIP)
            </LinkButton>
          </div>
        </footer>
      )}
    </div>
  );
}

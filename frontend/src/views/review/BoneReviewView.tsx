import { useEffect, useState } from "react";
import { apiClient } from "../../api/api_client";
import type { JobSummary } from "../../api/api_types";
import { ActionButton } from "../../components/common/ActionButton";
import { InlineMessage } from "../../components/common/InlineMessage";
import { JobProgressPanel } from "../../components/jobs/JobProgressPanel";
import { useApiResource } from "../../hooks/useApiResource";
import { useAssetJob } from "../../hooks/useAssetJob";
import { useStudio } from "../../state/StudioContext";
import layoutStyles from "../../styles/view_layout.module.css";
import { FacePairPanel, type FacePairDraft } from "./FacePairPanel";
import { JointLabelList } from "./JointLabelList";
import { SkeletonPreviewPanel } from "./SkeletonPreviewPanel";
import styles from "./BoneReviewView.module.css";

const EMPTY_FACE_PAIR: FacePairDraft = { right: "", left: "", body_axis: false };

/** Screen 2: check joint labels and the facing pair, fix the rest pose, then build the skeleton. */
export function BoneReviewView() {
  const { activeAsset, reloadAssets, showView } = useStudio();
  const [triggeredJobId, setTriggeredJobId] = useState<string | null>(null);
  const [labelsByRaw, setLabelsByRaw] = useState<Record<string, string>>({});
  const [facePairDraft, setFacePairDraft] = useState<FacePairDraft>(EMPTY_FACE_PAIR);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const activeAssetName = activeAsset?.name ?? null;
  const isProcessing = activeAsset?.status === "processing";
  const lookedUpJobId = useAssetJob(activeAssetName, isProcessing && !triggeredJobId);
  const visibleJobId = triggeredJobId ?? lookedUpJobId;
  const hasAnnotationFile = activeAsset !== null && !isProcessing && activeAsset.status !== "empty";

  const annotationResource = useApiResource(
    () => (activeAssetName && hasAnnotationFile ? apiClient.fetchAnnotation(activeAssetName) : Promise.resolve(null)),
    `${activeAssetName}-${activeAsset?.status}-${activeAsset?.annotation_preview_url}`,
  );
  const annotation = annotationResource.data;

  useEffect(() => {
    // fresh annotation from disk: reset the editable drafts
    if (!annotation) return;
    setLabelsByRaw(Object.fromEntries(annotation.joints.map((jointItem) => [jointItem.raw, jointItem.label])));
    setFacePairDraft({ right: annotation.face_pair.right, left: annotation.face_pair.left, body_axis: annotation.face_pair.body_axis });
    setHasUnsavedChanges(false);
  }, [annotation]);

  useEffect(() => {
    setTriggeredJobId(null);
    setActionErrorMessage(null);
    setSavedNotice(null);
  }, [activeAssetName]);

  /** Update one joint label in the draft. */
  const handleLabelChange = (rawName: string, nextLabel: string) => {
    setLabelsByRaw((previousLabels) => ({ ...previousLabels, [rawName]: nextLabel }));
    setHasUnsavedChanges(true);
    setSavedNotice(null);
  };

  /** Update the facing pair in the draft. */
  const handleFacePairChange = (nextFacePair: FacePairDraft) => {
    setFacePairDraft(nextFacePair);
    setHasUnsavedChanges(true);
    setSavedNotice(null);
  };

  /** Write the drafts to annotation.json; returns false when the backend refused them. */
  const saveDrafts = async (): Promise<boolean> => {
    if (!activeAssetName || !annotation) return false;
    const emptyLabelJoint = Object.entries(labelsByRaw).find(([, labelText]) => !labelText.trim());
    if (emptyLabelJoint) {
      setActionErrorMessage(`El hueso ${emptyLabelJoint[0]} no tiene etiqueta`);
      return false;
    }
    try {
      await apiClient.saveAnnotation(activeAssetName, facePairDraft,
        Object.entries(labelsByRaw).map(([rawName, labelText]) => ({ raw: rawName, label: labelText })));
      setHasUnsavedChanges(false);
      return true;
    } catch (saveError) {
      setActionErrorMessage(saveError instanceof Error ? saveError.message : String(saveError));
      return false;
    }
  };

  /** Run an async action with the shared busy/error handling. */
  const runAction = async (actionToRun: () => Promise<void>) => {
    setIsSending(true);
    setActionErrorMessage(null);
    setSavedNotice(null);
    try {
      await actionToRun();
    } catch (actionError) {
      setActionErrorMessage(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setIsSending(false);
    }
  };

  /** Save only. */
  const handleSaveClick = () => runAction(async () => {
    if (await saveDrafts()) setSavedNotice("Cambios guardados en annotation.json");
  });

  /** Save, then re-render the review with a rest rotation. */
  const handleApplyRotation = (restRotation: string) => runAction(async () => {
    if (!activeAssetName) return;
    if (hasUnsavedChanges && !(await saveDrafts())) return;
    const rotationResponse = await apiClient.applyRestRotation(activeAssetName, restRotation);
    setTriggeredJobId(rotationResponse.job_id);
    await reloadAssets();
  });

  /** Save, then build cond.npy + canonical GLB. */
  const handleBuildClick = () => runAction(async () => {
    if (!activeAssetName) return;
    if (hasUnsavedChanges && !(await saveDrafts())) return;
    const buildResponse = await apiClient.buildAsset(activeAssetName);
    setTriggeredJobId(buildResponse.job_id);
    await reloadAssets();
  });

  /** Refresh everything when the job ends. */
  const handleJobFinished = (finishedJob: JobSummary) => {
    void reloadAssets();
    void annotationResource.reload();
    if (finishedJob.status === "completed" && finishedJob.kind === "build") {
      setSavedNotice("Esqueleto construido. Ya podés generar animaciones.");
    }
  };

  if (!activeAsset) {
    return (
      <div className={layoutStyles.container_view_content}>
        <div className={layoutStyles.container_empty_state}>
          <h1 className={layoutStyles.text_empty_state_title}>No hay personaje activo</h1>
          <p>Elegí o subí un personaje en la pantalla 1.</p>
          <ActionButton variant="primary" onClick={() => showView("characters")}>Ir a Personajes</ActionButton>
        </div>
      </div>
    );
  }

  const isEditable = activeAsset.editable && activeAsset.has_source_file;
  const isBusy = isSending || isProcessing;

  return (
    <div className={layoutStyles.container_general_view}>
      <div className={layoutStyles.container_view_content}>
        <div className={styles.banner_orientation_requirement}>
          <span className={styles.icon_requirement} aria-hidden="true">⇧</span>
          <div>
            <strong className={styles.text_requirement_title}>
              Requisito de orientación <span className={styles.badge_requirement}>Paso crítico</span>
            </strong>
            <p className={styles.text_requirement_detail}>El personaje debe estar parado y mirando hacia +Z.</p>
          </div>
          <span className={styles.text_loaded_model}>Personaje: {activeAsset.display_name}</span>
        </div>

        {!activeAsset.editable && (
          <InlineMessage tone="info" title="Personaje de ejemplo">
            Ya viene construido con el repositorio: podés ver sus etiquetas, pero no editarlas.
          </InlineMessage>
        )}
        {activeAsset.status === "too_many_joints" && (
          <InlineMessage tone="danger" title={`Tiene ${activeAsset.joint_count} huesos y el máximo es ${activeAsset.max_joints}`}>
            Reexportá solo los huesos deformantes (sin dedos ni cara) y subilo de nuevo.
          </InlineMessage>
        )}
        {activeAsset.status === "failed" && activeAsset.last_error && (
          <InlineMessage tone="danger" title="El último proceso falló">{activeAsset.last_error}</InlineMessage>
        )}
        {actionErrorMessage && <InlineMessage tone="danger">{actionErrorMessage}</InlineMessage>}
        {savedNotice && <InlineMessage tone="success">{savedNotice}</InlineMessage>}
        {activeAsset.notes.length > 0 && (
          <InlineMessage tone="info" title="Notas del procesamiento">
            {activeAsset.notes.map((noteText) => <div key={noteText}>{noteText}</div>)}
          </InlineMessage>
        )}

        {visibleJobId && (
          <JobProgressPanel jobId={visibleJobId} title={`Procesando ${activeAsset.display_name}`} consoleHeight="compact"
            onFinished={handleJobFinished} />
        )}

        <div className={styles.grid_review_columns}>
          <SkeletonPreviewPanel assetItem={activeAsset} isBusy={isBusy} onApplyRotation={handleApplyRotation} />
          <div className={styles.container_editor_column}>
            {annotation ? (
              <>
                <FacePairPanel annotation={annotation} facePairDraft={facePairDraft} labelsByRaw={labelsByRaw}
                  isEditable={isEditable && !isBusy} onFacePairChange={handleFacePairChange} />
                <JointLabelList annotation={annotation} labelsByRaw={labelsByRaw} isEditable={isEditable && !isBusy}
                  onLabelChange={handleLabelChange} />
              </>
            ) : (
              <p className={styles.text_waiting_annotation}>
                {isProcessing ? "Esperando que termine el etiquetado…" : annotationResource.errorMessage ?? "Cargando etiquetas…"}
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className={layoutStyles.bar_view_footer}>
        <ActionButton variant="secondary" onClick={() => showView("characters")}>← Volver a Personajes</ActionButton>
        <div className={styles.container_footer_actions}>
          {hasUnsavedChanges && <span className={styles.text_unsaved_changes}>Cambios sin guardar</span>}
          {isEditable && (
            <ActionButton variant="secondary" onClick={handleSaveClick} disabled={!hasUnsavedChanges || isBusy}>
              Guardar cambios
            </ActionButton>
          )}
          {activeAsset.status === "ready" ? (
            <>
              {isEditable && (
                <ActionButton variant="secondary" iconSymbol="⚙" onClick={handleBuildClick} disabled={isBusy || !annotation}
                  title="Volver a construir con las etiquetas actuales">
                  Reconstruir
                </ActionButton>
              )}
              <ActionButton variant="primary" size="large" onClick={() => showView("generator")}>Ir al Generador →</ActionButton>
            </>
          ) : (
            <ActionButton variant="primary" size="large" iconSymbol="⚙" onClick={handleBuildClick}
              disabled={!isEditable || isBusy || !annotation || activeAsset.status === "too_many_joints"}>
              Construir esqueleto
            </ActionButton>
          )}
        </div>
      </footer>
    </div>
  );
}

import { useState } from "react";
import { apiClient } from "../../api/api_client";
import type { AssetInfo } from "../../api/api_types";
import { ActionButton } from "../../components/common/ActionButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { InlineMessage } from "../../components/common/InlineMessage";
import { PanelSection } from "../../components/common/PanelSection";
import { StatusPill } from "../../components/common/StatusPill";
import { JobProgressPanel } from "../../components/jobs/JobProgressPanel";
import { useStudio } from "../../state/StudioContext";
import layoutStyles from "../../styles/view_layout.module.css";
import { describeAssetStatus } from "../../utils/formatters";
import { CharacterTable } from "./CharacterTable";
import { UploadDropzone } from "./UploadDropzone";
import styles from "./CharactersView.module.css";

interface UploadInProgress {
  jobId: string;
  assetName: string;
}

/** Screen 1: upload a rigged character, pick the active one, see why one does not fit. */
export function CharactersView() {
  const { assets, assetsErrorMessage, reloadAssets, activeAsset, selectActiveAsset, showView } = useStudio();
  const [uploadInProgress, setUploadInProgress] = useState<UploadInProgress | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [assetPendingDeletion, setAssetPendingDeletion] = useState<AssetInfo | null>(null);

  /** Upload the file, make it the active character and follow its labelling job. */
  const handleUpload = async (modelFile: File, displayName: string) => {
    setIsUploading(true);
    setUploadErrorMessage(null);
    try {
      const uploadResponse = await apiClient.uploadAsset(modelFile, displayName);
      setUploadInProgress({ jobId: uploadResponse.job_id, assetName: uploadResponse.asset_name });
      selectActiveAsset(uploadResponse.asset_name);
      await reloadAssets();
    } catch (uploadError) {
      setUploadErrorMessage(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setIsUploading(false);
    }
  };

  /** Refresh the list once the labelling job ends. */
  const handleUploadJobFinished = () => {
    void reloadAssets();
  };

  /** Delete the confirmed character and clear it if it was active. */
  const handleConfirmDeletion = async () => {
    if (!assetPendingDeletion) return;
    const deletedName = assetPendingDeletion.name;
    setAssetPendingDeletion(null);
    try {
      await apiClient.deleteAsset(deletedName);
      if (activeAsset?.name === deletedName) selectActiveAsset(null);
      await reloadAssets();
    } catch (deletionError) {
      setUploadErrorMessage(deletionError instanceof Error ? deletionError.message : String(deletionError));
    }
  };

  /** Go to the next step that makes sense for the active character. */
  const handleContinueClick = () => {
    if (!activeAsset) return;
    showView(activeAsset.status === "ready" ? "generator" : "review");
  };

  const activeStatus = activeAsset ? describeAssetStatus(activeAsset.status) : null;
  const continueLabel = activeAsset?.status === "ready" ? "Continuar al Generador" : "Continuar a Revisión de Huesos";

  return (
    <div className={layoutStyles.container_general_view}>
      <div className={layoutStyles.container_view_content}>
        <header className={layoutStyles.header_view}>
          <div>
            <h1 className={layoutStyles.text_view_title}>Selección de Personaje y Armadura</h1>
            <p className={layoutStyles.text_view_subtitle}>
              Elegí un personaje para animar o agregá uno nuevo en formato GLB o FBX.
            </p>
          </div>
          <span className={layoutStyles.badge_view_info}>
            Límite por esqueleto: <span className={layoutStyles.text_badge_highlight}>máximo 70 huesos</span>
          </span>
        </header>

        <PanelSection>
          <UploadDropzone isUploading={isUploading} onUpload={handleUpload} />
          {uploadErrorMessage && (
            <div className={styles.container_upload_feedback}>
              <InlineMessage tone="danger" title="No se pudo completar">{uploadErrorMessage}</InlineMessage>
            </div>
          )}
          {uploadInProgress && (
            <div className={styles.container_upload_feedback}>
              <JobProgressPanel
                jobId={uploadInProgress.jobId}
                title={`Etiquetando huesos de ${uploadInProgress.assetName}`}
                consoleHeight="compact"
                onFinished={handleUploadJobFinished}
              />
            </div>
          )}
        </PanelSection>

        <PanelSection
          title="Personajes en biblioteca"
          headerExtra={<span className={styles.text_library_hint}>Hacé clic en una fila para elegir el personaje activo</span>}
          hasBodyPadding={false}
        >
          {assetsErrorMessage && assets.length === 0 ? (
            <div className={styles.container_upload_feedback}>
              <InlineMessage tone="danger" title="No se pudo leer la biblioteca">{assetsErrorMessage}</InlineMessage>
            </div>
          ) : (
            <CharacterTable
              assets={assets}
              activeAssetName={activeAsset?.name ?? null}
              onSelectAsset={(assetItem) => selectActiveAsset(assetItem.name)}
              onReviewAsset={(assetItem) => { selectActiveAsset(assetItem.name); showView("review"); }}
              onDeleteAsset={setAssetPendingDeletion}
            />
          )}
        </PanelSection>

        <InlineMessage tone="warning" title="¿Tu modelo supera el límite de 70 huesos?">
          Reexportá solo los huesos deformantes (por ejemplo los <code>DEF-*</code> de Rigify), sin dedos ni huesos de cara.
          Los controladores IK, MCH y widgets no se usan: excluilos al exportar desde Blender.
        </InlineMessage>
      </div>

      <footer className={layoutStyles.bar_view_footer}>
        <div className={styles.container_active_character}>
          <span className={styles.icon_active_character} aria-hidden="true">☺</span>
          <div>
            <span className={styles.text_active_character_caption}>Personaje activo</span>
            <strong className={styles.text_active_character_name}>{activeAsset?.display_name ?? "Ninguno"}</strong>
          </div>
          <label className={styles.label_change_character}>
            Cambiar:
            <select
              className={styles.select_active_character}
              value={activeAsset?.name ?? ""}
              onChange={(changeEvent) => selectActiveAsset(changeEvent.target.value || null)}
            >
              <option value="">— elegir —</option>
              {assets.map((assetItem) => (
                <option key={assetItem.name} value={assetItem.name}>
                  {assetItem.display_name} ({assetItem.joint_count ?? "?"}/{assetItem.max_joints})
                </option>
              ))}
            </select>
          </label>
          {activeAsset && activeStatus && (
            <StatusPill tone={activeStatus.tone}>
              {activeAsset.joint_count ?? "?"}/{activeAsset.max_joints} huesos · {activeStatus.label}
            </StatusPill>
          )}
        </div>
        <ActionButton variant="primary" size="large" onClick={handleContinueClick}
          disabled={!activeAsset || activeAsset.status === "processing" || activeAsset.status === "too_many_joints"}>
          {continueLabel} →
        </ActionButton>
      </footer>

      <ConfirmDialog
        isOpen={assetPendingDeletion !== null}
        title="¿Borrar personaje?"
        confirmLabel="Borrar"
        isDanger
        onConfirm={handleConfirmDeletion}
        onCancel={() => setAssetPendingDeletion(null)}
      >
        Se borran la carpeta de <strong>{assetPendingDeletion?.display_name}</strong> y el archivo subido.
        Las tandas ya generadas no se tocan.
      </ConfirmDialog>
    </div>
  );
}

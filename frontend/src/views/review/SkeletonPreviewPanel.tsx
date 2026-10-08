import { useEffect, useState } from "react";
import type { AssetInfo } from "../../api/api_types";
import { ActionButton } from "../../components/common/ActionButton";
import { PanelSection } from "../../components/common/PanelSection";
import { AnimatedModelViewer } from "../../components/viewer/AnimatedModelViewer";
import styles from "./SkeletonPreviewPanel.module.css";

type PreviewMode = "labels" | "result" | "model";

const REST_ROTATION_OPTIONS: { value: string; label: string; symbol: string }[] = [
  { value: "", label: "Sin rotación", symbol: "○" },
  { value: "x90", label: "+90° X", symbol: "↻" },
  { value: "x-90", label: "−90° X", symbol: "↺" },
  { value: "x180", label: "180° X", symbol: "⇅" },
  { value: "y180", label: "180° Y", symbol: "⇄" },
];

interface SkeletonPreviewPanelProps {
  assetItem: AssetInfo;
  isBusy: boolean;
  onApplyRotation: (restRotation: string) => void;
}

/** Left column: rest-pose images (labels / built result / 3D model) plus the rest rotation buttons. */
export function SkeletonPreviewPanel({ assetItem, isBusy, onApplyRotation }: SkeletonPreviewPanelProps) {
  const availableModes: PreviewMode[] = [
    ...(assetItem.annotation_preview_url ? ["labels" as const] : []),
    ...(assetItem.preview_url ? ["result" as const] : []),
    ...(assetItem.canonical_glb_url ? ["model" as const] : []),
  ];
  const [previewMode, setPreviewMode] = useState<PreviewMode>(availableModes[0] ?? "labels");

  useEffect(() => {
    // after a build the result becomes available: show the most advanced view
    setPreviewMode(assetItem.status === "review" ? "labels" : assetItem.preview_url ? "result" : "labels");
  }, [assetItem.name, assetItem.status, assetItem.preview_url]);

  const modeLabels: Record<PreviewMode, string> = {
    labels: "Etiquetas y orientación",
    result: "Pose canónica",
    model: "Modelo 3D",
  };

  return (
    <div className={styles.container_preview_column}>
      <PanelSection
        title="Vista del esqueleto"
        iconSymbol="◉"
        hasBodyPadding={false}
        headerExtra={
          <div className={styles.container_preview_tabs}>
            {availableModes.map((availableMode) => (
              <button
                key={availableMode}
                type="button"
                className={`${styles.button_preview_tab} ${previewMode === availableMode ? styles.button_preview_tab_active : ""}`}
                onClick={() => setPreviewMode(availableMode)}
              >
                {modeLabels[availableMode]}
              </button>
            ))}
          </div>
        }
      >
        <div className={styles.container_preview_stage}>
          {previewMode === "labels" && assetItem.annotation_preview_url && (
            <img className={styles.image_skeleton_preview} src={assetItem.annotation_preview_url} alt="Pose de reposo con etiquetas" />
          )}
          {previewMode === "result" && assetItem.preview_url && (
            <img className={styles.image_skeleton_preview} src={assetItem.preview_url} alt="Pose canónica del personaje" />
          )}
          {previewMode === "model" && assetItem.canonical_glb_url && (
            <AnimatedModelViewer glbUrl={assetItem.canonical_glb_url} overlayLabel="Canónico · +Z al frente" />
          )}
          {availableModes.length === 0 && <p className={styles.text_preview_empty}>Todavía no hay vista previa.</p>}
        </div>
        <p className={styles.text_preview_legend}>
          En la imagen de etiquetas: rojo = hueso derecho del par, azul = izquierdo, flecha verde = hacia dónde mira.
        </p>
      </PanelSection>

      <PanelSection
        title="Corrección de orientación"
        description="Usá estos botones si el modelo llegó acostado, boca abajo o mirando para atrás. Se vuelve a generar la vista conservando tus etiquetas."
        headerExtra={<span className={styles.text_rotation_state}>Actual: {assetItem.rest_rotation || "sin rotación"}</span>}
      >
        <div className={styles.grid_rotation_buttons}>
          {REST_ROTATION_OPTIONS.map((rotationOption) => (
            <ActionButton
              key={rotationOption.value || "none"}
              iconSymbol={rotationOption.symbol}
              variant={assetItem.rest_rotation === rotationOption.value ? "primary" : "secondary"}
              disabled={!assetItem.editable || !assetItem.has_source_file || isBusy || assetItem.rest_rotation === rotationOption.value}
              onClick={() => onApplyRotation(rotationOption.value)}
            >
              {rotationOption.label}
            </ActionButton>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}

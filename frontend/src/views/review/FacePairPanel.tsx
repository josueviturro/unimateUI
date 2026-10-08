import type { Annotation, AnnotationJoint } from "../../api/api_types";
import { InlineMessage } from "../../components/common/InlineMessage";
import { PanelSection } from "../../components/common/PanelSection";
import { StatusPill } from "../../components/common/StatusPill";
import styles from "./FacePairPanel.module.css";

export interface FacePairDraft {
  right: string;
  left: string;
  body_axis: boolean;
}

interface FacePairPanelProps {
  annotation: Annotation;
  facePairDraft: FacePairDraft;
  labelsByRaw: Record<string, string>;
  isEditable: boolean;
  onFacePairChange: (nextFacePair: FacePairDraft) => void;
}

/** Facing pair editor: which left/right bones (usually the thighs) define where the character faces. */
export function FacePairPanel({ annotation, facePairDraft, labelsByRaw, isEditable, onFacePairChange }: FacePairPanelProps) {
  const isConfigured = Boolean(facePairDraft.right && facePairDraft.left);

  /** Text shown in each option: raw bone name plus its current label. */
  const describeJointOption = (jointItem: AnnotationJoint) => `${jointItem.raw} · ${labelsByRaw[jointItem.raw] ?? jointItem.label}`;

  return (
    <PanelSection
      title="Par de orientación (izquierda / derecha)"
      iconSymbol="⚖"
      headerExtra={
        <StatusPill tone={!isConfigured ? "danger" : annotation.face_pair.check ? "warning" : "success"}>
          {!isConfigured ? "Sin par" : annotation.face_pair.check ? "Revisar" : "Configurado"}
        </StatusPill>
      }
      description="Dos huesos simétricos (idealmente los muslos u hombros) que fijan el frente del personaje (+Z)."
    >
      <div className={styles.grid_face_pair_selects}>
        <label className={styles.label_face_pair_field}>
          Hueso izquierdo (L)
          <select
            className={styles.select_face_pair_joint}
            value={facePairDraft.left}
            disabled={!isEditable}
            onChange={(changeEvent) => onFacePairChange({ ...facePairDraft, left: changeEvent.target.value })}
          >
            <option value="">— ninguno —</option>
            {annotation.joints.map((jointItem) => (
              <option key={jointItem.raw} value={jointItem.raw}>{describeJointOption(jointItem)}</option>
            ))}
          </select>
        </label>
        <label className={styles.label_face_pair_field}>
          Hueso derecho (R)
          <select
            className={styles.select_face_pair_joint}
            value={facePairDraft.right}
            disabled={!isEditable}
            onChange={(changeEvent) => onFacePairChange({ ...facePairDraft, right: changeEvent.target.value })}
          >
            <option value="">— ninguno —</option>
            {annotation.joints.map((jointItem) => (
              <option key={jointItem.raw} value={jointItem.raw}>{describeJointOption(jointItem)}</option>
            ))}
          </select>
        </label>
      </div>

      {annotation.face_pair_alternatives.length > 0 && (
        <div className={styles.container_face_pair_alternatives}>
          <span className={styles.text_alternatives_caption}>Sugerencias:</span>
          {annotation.face_pair_alternatives.map(([rightRaw, leftRaw, partName]) => (
            <button
              key={`${rightRaw}-${leftRaw}`}
              type="button"
              className={styles.chip_face_pair_alternative}
              disabled={!isEditable}
              onClick={() => onFacePairChange({ right: rightRaw, left: leftRaw, body_axis: false })}
            >
              {partName}
            </button>
          ))}
        </div>
      )}

      <label className={styles.label_body_axis}>
        <input
          type="checkbox"
          checked={facePairDraft.body_axis}
          disabled={!isEditable}
          onChange={(changeEvent) => onFacePairChange({ ...facePairDraft, body_axis: changeEvent.target.checked })}
        />
        Es un eje cabeza / cola (para peces o serpientes: "derecho" = cabeza)
      </label>

      {annotation.face_pair.reasons && annotation.face_pair.reasons.length > 0 && (
        <InlineMessage tone="warning">
          {annotation.face_pair.reasons.map((reasonText) => <div key={reasonText}>{reasonText}</div>)}
        </InlineMessage>
      )}
    </PanelSection>
  );
}

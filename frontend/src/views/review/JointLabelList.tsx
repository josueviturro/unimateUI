import { useMemo, useState } from "react";
import type { Annotation } from "../../api/api_types";
import { PanelSection } from "../../components/common/PanelSection";
import styles from "./JointLabelList.module.css";

const SIDE_PREFIXES = ["", "Left ", "Right "];
const VOCABULARY_DATALIST_ID = "joint_label_vocabulary";

interface JointLabelListProps {
  annotation: Annotation;
  labelsByRaw: Record<string, string>;
  isEditable: boolean;
  onLabelChange: (rawName: string, nextLabel: string) => void;
}

/** Suggested labels: every vocabulary part with and without Left/Right, plus labels already in use. */
function buildLabelSuggestions(annotation: Annotation): string[] {
  const vocabularyParts = annotation.vocabulary?.parts ?? [];
  const suggestedLabels = new Set<string>(annotation.joints.map((jointItem) => jointItem.label));
  vocabularyParts.forEach((partName) => {
    SIDE_PREFIXES.forEach((sidePrefix) => suggestedLabels.add(`${sidePrefix}${partName}`));
    suggestedLabels.add(`${partName} End`);
  });
  return [...suggestedLabels].sort();
}

/** List of every joint with its editable label; flagged joints are highlighted with the reason. */
export function JointLabelList({ annotation, labelsByRaw, isEditable, onLabelChange }: JointLabelListProps) {
  const [isShowingFlaggedOnly, setIsShowingFlaggedOnly] = useState(annotation.n_flagged > 0);
  const labelSuggestions = useMemo(() => buildLabelSuggestions(annotation), [annotation]);
  const visibleJoints = isShowingFlaggedOnly ? annotation.joints.filter((jointItem) => jointItem.check) : annotation.joints;

  return (
    <PanelSection
      title="Asignación de huesos"
      iconSymbol="⌥"
      className={styles.panel_joint_labels}
      hasBodyPadding={false}
      headerExtra={
        <>
          {annotation.n_flagged > 0 && <span className={styles.text_flagged_count}>⚠ {annotation.n_flagged} dudosos</span>}
          <label className={styles.label_flagged_filter}>
            <input type="checkbox" checked={isShowingFlaggedOnly} onChange={(changeEvent) => setIsShowingFlaggedOnly(changeEvent.target.checked)} />
            Solo dudosos
          </label>
        </>
      }
    >
      <p className={styles.text_joint_list_help}>
        Etiquetas en inglés: lado como prefijo (<code>Left Thigh</code>), cadenas repetidas (<code>Spine</code>, <code>Spine</code>),
        punta de cadena con <code>End</code> (<code>Tail End</code>), y <code>Bone</code> para huesos que no son parte del cuerpo.
      </p>
      <datalist id={VOCABULARY_DATALIST_ID}>
        {labelSuggestions.map((suggestedLabel) => <option key={suggestedLabel} value={suggestedLabel} />)}
      </datalist>
      <ul className={styles.list_joint_labels}>
        {visibleJoints.length === 0 && <li className={styles.text_joint_list_empty}>No hay huesos dudosos. ✓</li>}
        {visibleJoints.map((jointItem) => (
          <li key={jointItem.raw} className={`${styles.item_joint_label} ${jointItem.check ? styles.item_joint_flagged : ""}`}>
            <span className={styles.icon_joint_state} aria-hidden="true">{jointItem.check ? "⚠" : "✓"}</span>
            <div className={styles.container_joint_names}>
              <span className={styles.text_joint_raw_name} title={jointItem.raw}>{jointItem.raw}</span>
              <span className={styles.text_joint_detail}>
                {jointItem.check ? jointItem.reasons?.join(" · ") : jointItem.parent ? `hijo de ${jointItem.parent}` : "raíz"}
              </span>
            </div>
            <input
              className={styles.input_joint_label}
              list={VOCABULARY_DATALIST_ID}
              value={labelsByRaw[jointItem.raw] ?? jointItem.label}
              disabled={!isEditable}
              maxLength={64}
              onChange={(changeEvent) => onLabelChange(jointItem.raw, changeEvent.target.value)}
              aria-label={`Etiqueta de ${jointItem.raw}`}
            />
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}

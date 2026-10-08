import { useState } from "react";
import type { GenerationMode } from "../../api/api_types";
import { ActionButton } from "../../components/common/ActionButton";
import { InlineMessage } from "../../components/common/InlineMessage";
import { findPromptWarnings, PROMPT_PREFIX, PROMPT_SOFT_LIMIT, SUGGESTED_ACTIONS } from "../../utils/prompt_rules";
import styles from "./PromptComposer.module.css";

export const MAX_CHAINED_SEGMENTS = 6;
const MIN_CHAINED_SEGMENTS = 2;

interface PromptComposerProps {
  generationMode: GenerationMode;
  actionTexts: string[];
  onActionTextsChange: (nextActionTexts: string[]) => void;
}

/** Prompt editor: fixed "An object" prefix, one action (Normal) or a sequence of actions (Chained). */
export function PromptComposer({ generationMode, actionTexts, onActionTextsChange }: PromptComposerProps) {
  const [focusedSegmentIndex, setFocusedSegmentIndex] = useState(0);
  const isChained = generationMode === "expand";
  const visibleTexts = isChained ? actionTexts : actionTexts.slice(0, 1);
  const allWarnings = [...new Set(visibleTexts.flatMap((actionText) => findPromptWarnings(actionText)))];

  /** Replace the text of one segment. */
  const updateSegment = (segmentIndex: number, nextText: string) => {
    onActionTextsChange(actionTexts.map((actionText, textIndex) => (textIndex === segmentIndex ? nextText : actionText)));
  };

  /** Put a suggested action into the focused segment (Normal mode: the only one). */
  const applySuggestion = (suggestedAction: string) => {
    updateSegment(isChained ? focusedSegmentIndex : 0, suggestedAction);
  };

  /** Add an empty action at the end of the chain. */
  const addSegment = () => {
    if (actionTexts.length >= MAX_CHAINED_SEGMENTS) return;
    onActionTextsChange([...actionTexts, ""]);
    setFocusedSegmentIndex(actionTexts.length);
  };

  /** Remove one action from the chain (keeps at least two). */
  const removeSegment = (segmentIndex: number) => {
    if (actionTexts.length <= MIN_CHAINED_SEGMENTS) return;
    onActionTextsChange(actionTexts.filter((_actionText, textIndex) => textIndex !== segmentIndex));
    setFocusedSegmentIndex(0);
  };

  return (
    <div className={styles.container_prompt_composer}>
      <div className={styles.row_prompt_header}>
        <span className={styles.text_prompt_caption}>{isChained ? "Secuencia de acciones (inglés)" : "Texto de acción (inglés)"}</span>
        {!isChained && (
          <span className={styles.text_prompt_counter}>{visibleTexts[0]?.trim().length ?? 0} / {PROMPT_SOFT_LIMIT} car.</span>
        )}
      </div>

      {visibleTexts.map((actionText, segmentIndex) => (
        <div key={segmentIndex} className={`${styles.field_prompt_segment} ${focusedSegmentIndex === segmentIndex && isChained ? styles.field_segment_focused : ""}`}>
          {isChained && <span className={styles.text_segment_number}>{segmentIndex + 1}</span>}
          <span className={styles.text_prompt_prefix}>{PROMPT_PREFIX}</span>
          <input
            className={styles.input_prompt_action}
            value={actionText}
            placeholder="walks forward."
            maxLength={110}
            onFocus={() => setFocusedSegmentIndex(segmentIndex)}
            onChange={(changeEvent) => updateSegment(segmentIndex, changeEvent.target.value)}
            aria-label={`Acción ${segmentIndex + 1}`}
          />
          {actionText && !isChained && (
            <button type="button" className={styles.button_clear_prompt} onClick={() => updateSegment(segmentIndex, "")} aria-label="Borrar texto">×</button>
          )}
          {isChained && actionTexts.length > MIN_CHAINED_SEGMENTS && (
            <button type="button" className={styles.button_clear_prompt} onClick={() => removeSegment(segmentIndex)} aria-label="Quitar acción">−</button>
          )}
        </div>
      ))}

      {isChained && (
        <ActionButton size="small" variant="ghost" iconSymbol="＋" onClick={addSegment} disabled={actionTexts.length >= MAX_CHAINED_SEGMENTS}>
          Agregar acción ({actionTexts.length}/{MAX_CHAINED_SEGMENTS})
        </ActionButton>
      )}

      <InlineMessage tone={allWarnings.length > 0 ? "warning" : "info"}>
        {allWarnings.length > 0
          ? allWarnings.map((warningText) => <div key={warningText}>{warningText}</div>)
          : <>Usá frases cortas de una sola acción (ej. <em>walks forward</em>). No describas el aspecto del personaje.</>}
      </InlineMessage>

      <div className={styles.container_suggestions}>
        <div className={styles.row_suggestions_header}>
          <span className={styles.text_suggestions_caption}>Acciones rápidas</span>
          <span className={styles.text_suggestions_hint}>
            {isChained ? `Reemplaza la acción ${focusedSegmentIndex + 1}` : "Reemplaza el texto"}
          </span>
        </div>
        <div className={styles.list_suggestion_chips}>
          {SUGGESTED_ACTIONS.map((suggestedAction) => (
            <button key={suggestedAction} type="button" className={styles.chip_suggested_action} onClick={() => applySuggestion(suggestedAction)}>
              {suggestedAction}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

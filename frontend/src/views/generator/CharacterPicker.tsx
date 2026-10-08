import type { AssetInfo } from "../../api/api_types";
import { PanelSection } from "../../components/common/PanelSection";
import styles from "./CharacterPicker.module.css";

export const MAX_CHARACTERS_PER_RUN = 4;

interface CharacterPickerProps {
  readyAssets: AssetInfo[];
  selectedAssetNames: string[];
  onSelectionChange: (nextSelection: string[]) => void;
}

/** Checkbox list of the characters that are ready to animate (every prompt runs on every checked one). */
export function CharacterPicker({ readyAssets, selectedAssetNames, onSelectionChange }: CharacterPickerProps) {
  /** Check or uncheck one character, respecting the per-run maximum. */
  const toggleAsset = (assetName: string) => {
    if (selectedAssetNames.includes(assetName)) {
      onSelectionChange(selectedAssetNames.filter((selectedName) => selectedName !== assetName));
    } else if (selectedAssetNames.length < MAX_CHARACTERS_PER_RUN) {
      onSelectionChange([...selectedAssetNames, assetName]);
    }
  };

  return (
    <PanelSection
      title="Personajes"
      iconSymbol="☺"
      headerExtra={<span className={styles.badge_selected_count}>{selectedAssetNames.length} activos</span>}
    >
      {readyAssets.length === 0 && (
        <p className={styles.text_picker_empty}>No hay personajes listos. Construí uno en la pantalla 2.</p>
      )}
      <ul className={styles.list_character_options}>
        {readyAssets.map((assetItem) => {
          const isSelected = selectedAssetNames.includes(assetItem.name);
          return (
            <li key={assetItem.name}>
              <label className={`${styles.card_character_option} ${isSelected ? styles.card_character_selected : ""}`}>
                <input
                  type="checkbox"
                  className={styles.checkbox_character_option}
                  checked={isSelected}
                  onChange={() => toggleAsset(assetItem.name)}
                />
                {assetItem.preview_url
                  ? <img className={styles.image_character_option} src={assetItem.preview_url} alt="" loading="lazy" />
                  : <span className={styles.image_character_option} aria-hidden="true" />}
                <span className={styles.container_character_option_text}>
                  <strong className={styles.text_character_option_name}>{assetItem.display_name}</strong>
                  <span className={styles.text_character_option_detail}>{assetItem.joint_count} huesos</span>
                  <span className={isSelected ? styles.text_option_assigned : styles.text_option_idle}>
                    {isSelected ? "Asignado a la generación" : "Sin asignar"}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {selectedAssetNames.length >= MAX_CHARACTERS_PER_RUN && (
        <p className={styles.text_picker_limit}>Máximo {MAX_CHARACTERS_PER_RUN} personajes por tanda.</p>
      )}
    </PanelSection>
  );
}

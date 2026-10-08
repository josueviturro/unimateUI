import type { MouseEvent } from "react";
import type { AssetInfo } from "../../api/api_types";
import { ActionButton } from "../../components/common/ActionButton";
import { StatusPill } from "../../components/common/StatusPill";
import { describeAssetStatus } from "../../utils/formatters";
import styles from "./CharacterTable.module.css";

interface CharacterTableProps {
  assets: AssetInfo[];
  activeAssetName: string | null;
  onSelectAsset: (assetItem: AssetInfo) => void;
  onReviewAsset: (assetItem: AssetInfo) => void;
  onDeleteAsset: (assetItem: AssetInfo) => void;
}

/** Character library: preview, name, bone count against the limit, status and actions. */
export function CharacterTable({ assets, activeAssetName, onSelectAsset, onReviewAsset, onDeleteAsset }: CharacterTableProps) {
  if (assets.length === 0) {
    return <p className={styles.text_table_empty}>Todavía no hay personajes. Subí el primero arriba.</p>;
  }
  return (
    <div className={styles.container_table_scroll}>
      <table className={styles.table_characters}>
        <thead>
          <tr>
            <th className={styles.cell_header}>Vista</th>
            <th className={styles.cell_header}>Nombre del personaje</th>
            <th className={styles.cell_header}>Huesos</th>
            <th className={styles.cell_header}>Estado</th>
            <th className={`${styles.cell_header} ${styles.cell_align_right}`}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((assetItem) => (
            <CharacterRow
              key={assetItem.name}
              assetItem={assetItem}
              isActive={assetItem.name === activeAssetName}
              onSelectAsset={onSelectAsset}
              onReviewAsset={onReviewAsset}
              onDeleteAsset={onDeleteAsset}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CharacterRowProps {
  assetItem: AssetInfo;
  isActive: boolean;
  onSelectAsset: (assetItem: AssetInfo) => void;
  onReviewAsset: (assetItem: AssetInfo) => void;
  onDeleteAsset: (assetItem: AssetInfo) => void;
}

/** One library row; clicking it makes the character active. */
function CharacterRow({ assetItem, isActive, onSelectAsset, onReviewAsset, onDeleteAsset }: CharacterRowProps) {
  const statusPresentation = describeAssetStatus(assetItem.status);
  const jointCountClass = !assetItem.fits_model ? styles.text_joint_count_over
    : assetItem.status === "review" ? styles.text_joint_count_review : styles.text_joint_count_ok;
  const previewUrl = assetItem.preview_url ?? assetItem.annotation_preview_url;

  /** Stop the row click so the button action is the only one that runs. */
  const runWithoutRowClick = (clickAction: () => void) => (clickEvent: MouseEvent) => {
    clickEvent.stopPropagation();
    clickAction();
  };

  return (
    <tr className={`${styles.row_character} ${isActive ? styles.row_character_active : ""}`} onClick={() => onSelectAsset(assetItem)}>
      <td className={styles.cell_body}>
        {previewUrl
          ? <img className={styles.image_character_thumbnail} src={previewUrl} alt="" loading="lazy" />
          : <span className={styles.image_character_placeholder} aria-hidden="true">◇</span>}
      </td>
      <td className={styles.cell_body}>
        <span className={styles.text_character_name}>{assetItem.display_name}</span>
        {assetItem.source_extension && <span className={styles.text_character_extension}>.{assetItem.source_extension}</span>}
        {assetItem.origin === "example" && <span className={styles.badge_example_asset}>ejemplo</span>}
        {assetItem.status === "too_many_joints" && (
          <span className={styles.text_character_problem}>Supera el límite: reexportá solo huesos deformantes.</span>
        )}
        {assetItem.status === "failed" && assetItem.last_error && (
          <span className={styles.text_character_problem}>{assetItem.last_error}</span>
        )}
      </td>
      <td className={`${styles.cell_body} ${jointCountClass}`}>
        {assetItem.joint_count ?? "?"}/{assetItem.max_joints}
      </td>
      <td className={styles.cell_body}>
        <StatusPill tone={statusPresentation.tone} isPulsing={assetItem.status === "processing"}>
          {statusPresentation.label}
        </StatusPill>
      </td>
      <td className={`${styles.cell_body} ${styles.cell_align_right}`}>
        <div className={styles.container_row_actions}>
          {assetItem.status === "review" && (
            <ActionButton size="small" variant="primary" onClick={runWithoutRowClick(() => onReviewAsset(assetItem))}>Revisar</ActionButton>
          )}
          {assetItem.status === "ready" && (
            <ActionButton size="small" onClick={runWithoutRowClick(() => onSelectAsset(assetItem))}>
              {isActive ? "Activo ✓" : "Seleccionar"}
            </ActionButton>
          )}
          {assetItem.editable && assetItem.status !== "processing" && (
            <ActionButton size="small" variant="ghost" title="Borrar personaje" onClick={runWithoutRowClick(() => onDeleteAsset(assetItem))}>
              🗑
            </ActionButton>
          )}
        </div>
      </td>
    </tr>
  );
}

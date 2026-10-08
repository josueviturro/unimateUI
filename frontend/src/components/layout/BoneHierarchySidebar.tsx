import { useMemo } from "react";
import { apiClient } from "../../api/api_client";
import type { AnnotationJoint } from "../../api/api_types";
import { useApiResource } from "../../hooks/useApiResource";
import { useStudio } from "../../state/StudioContext";
import styles from "./BoneHierarchySidebar.module.css";

interface HierarchyRow {
  joint: AnnotationJoint;
  depth: number;
}

const MAX_INDENT_DEPTH = 12;

/** Depth-first ordering of the joints so children appear under their parent. */
function buildHierarchyRows(joints: AnnotationJoint[]): HierarchyRow[] {
  const childrenByParent = new Map<string | null, AnnotationJoint[]>();
  joints.forEach((jointItem) => {
    const siblingList = childrenByParent.get(jointItem.parent) ?? [];
    siblingList.push(jointItem);
    childrenByParent.set(jointItem.parent, siblingList);
  });
  const orderedRows: HierarchyRow[] = [];

  /** Add a joint and then all its descendants. */
  const visitJoint = (jointItem: AnnotationJoint, depth: number) => {
    orderedRows.push({ joint: jointItem, depth });
    (childrenByParent.get(jointItem.raw) ?? []).forEach((childJoint) => visitJoint(childJoint, depth + 1));
  };
  (childrenByParent.get(null) ?? []).forEach((rootJoint) => visitJoint(rootJoint, 0));
  return orderedRows;
}

/** Left sidebar: the active character's bone tree (raw name + label), flagged bones in amber. */
export function BoneHierarchySidebar() {
  const { activeAsset } = useStudio();
  const activeAssetName = activeAsset?.name ?? null;
  const hasAnnotation = activeAsset !== null && activeAsset.status !== "processing" && activeAsset.status !== "empty";
  const annotationResource = useApiResource(
    () => (activeAssetName && hasAnnotation ? apiClient.fetchAnnotation(activeAssetName) : Promise.resolve(null)),
    `${activeAssetName}-${activeAsset?.status}-${activeAsset?.annotation_preview_url}`,
  );
  const hierarchyRows = useMemo(
    () => buildHierarchyRows(annotationResource.data?.joints ?? []),
    [annotationResource.data],
  );

  return (
    <aside className={styles.sidebar_bone_hierarchy}>
      <h2 className={styles.text_sidebar_title}>Estructura del esqueleto</h2>
      {!activeAsset && <p className={styles.text_sidebar_hint}>Elegí un personaje para ver sus huesos.</p>}
      {activeAsset && (
        <div className={styles.container_sidebar_asset}>
          <span className={styles.text_sidebar_asset_name}>{activeAsset.display_name}</span>
          <span className={styles.text_sidebar_joint_count}>
            {activeAsset.joint_count ?? "?"}/{activeAsset.max_joints} huesos
          </span>
        </div>
      )}
      {activeAsset && !hasAnnotation && <p className={styles.text_sidebar_hint}>Todavía no hay huesos etiquetados.</p>}
      {annotationResource.errorMessage && hasAnnotation && (
        <p className={styles.text_sidebar_hint}>{annotationResource.errorMessage}</p>
      )}
      <ul className={styles.list_bone_tree}>
        {hierarchyRows.map((hierarchyRow) => (
          <li
            key={hierarchyRow.joint.raw}
            className={`${styles.item_bone_tree} ${hierarchyRow.joint.check ? styles.item_bone_flagged : ""}`}
            style={{ paddingLeft: `${8 + Math.min(hierarchyRow.depth, MAX_INDENT_DEPTH) * 10}px` }}
            title={hierarchyRow.joint.reasons?.join("\n") ?? `${hierarchyRow.joint.raw} → ${hierarchyRow.joint.label}`}
          >
            <span className={styles.icon_bone_branch} aria-hidden="true">{hierarchyRow.depth === 0 ? "◆" : "└"}</span>
            <span className={styles.text_bone_raw_name}>{hierarchyRow.joint.raw}</span>
            <span className={styles.text_bone_label}>{hierarchyRow.joint.label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

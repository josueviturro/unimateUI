import { useMemo, useState } from "react";
import { apiClient } from "../../api/api_client";
import type { GenerationMode, RunStatus, RunSummary } from "../../api/api_types";
import { ActionButton, LinkButton } from "../../components/common/ActionButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { InlineMessage } from "../../components/common/InlineMessage";
import { StatusPill } from "../../components/common/StatusPill";
import { useApiResource } from "../../hooks/useApiResource";
import { useStudio } from "../../state/StudioContext";
import layoutStyles from "../../styles/view_layout.module.css";
import { describeRunStatus, formatBytes, formatRunDate } from "../../utils/formatters";
import styles from "./HistoryView.module.css";

const HISTORY_POLL_MILLISECONDS = 5000;
const ALL_FILTER_VALUE = "all";

type ModeFilter = GenerationMode | typeof ALL_FILTER_VALUE;
type StatusFilter = RunStatus | typeof ALL_FILTER_VALUE;

/** True when the run matches the search text (prompt, run name or seed). */
function matchesSearch(runRow: RunSummary, searchText: string): boolean {
  const normalizedSearch = searchText.trim().toLowerCase();
  if (!normalizedSearch) return true;
  return [runRow.run_name, String(runRow.seed ?? ""), ...runRow.prompts]
    .some((searchableText) => searchableText.toLowerCase().includes(normalizedSearch));
}

/** Screen 5: every run with filters; reopen, relaunch, download or delete. */
export function HistoryView() {
  const { openRunResults, setActiveGeneration, showView } = useStudio();
  const runsResource = useApiResource(apiClient.fetchRuns, "history-runs", HISTORY_POLL_MILLISECONDS);
  const storageResource = useApiResource(apiClient.fetchStorage, "history-storage", HISTORY_POLL_MILLISECONDS);
  const [searchText, setSearchText] = useState("");
  const [assetFilter, setAssetFilter] = useState(ALL_FILTER_VALUE);
  const [modeFilter, setModeFilter] = useState<ModeFilter>(ALL_FILTER_VALUE);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL_FILTER_VALUE);
  const [runPendingDeletion, setRunPendingDeletion] = useState<RunSummary | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const allRuns = runsResource.data ?? [];
  const assetNamesInHistory = useMemo(
    () => [...new Set(allRuns.flatMap((runRow) => runRow.assets))].sort(),
    [allRuns],
  );
  const visibleRuns = allRuns.filter((runRow) =>
    matchesSearch(runRow, searchText)
    && (assetFilter === ALL_FILTER_VALUE || runRow.assets.includes(assetFilter))
    && (modeFilter === ALL_FILTER_VALUE || runRow.mode === modeFilter)
    && (statusFilter === ALL_FILTER_VALUE || runRow.status === statusFilter));

  /** Same parameters, new seed; follow the new run in the generator. */
  const handleRelaunch = async (runRow: RunSummary) => {
    setActionErrorMessage(null);
    try {
      const relaunchResponse = await apiClient.relaunchRun(runRow.run_name);
      setActiveGeneration({ jobId: relaunchResponse.job_id, runName: relaunchResponse.run_name });
      showView("generator");
    } catch (relaunchError) {
      setActionErrorMessage(relaunchError instanceof Error ? relaunchError.message : String(relaunchError));
    }
  };

  /** Delete the confirmed run and refresh the table. */
  const handleConfirmDeletion = async () => {
    if (!runPendingDeletion) return;
    const deletedRunName = runPendingDeletion.run_name;
    setRunPendingDeletion(null);
    setActionErrorMessage(null);
    try {
      await apiClient.deleteRun(deletedRunName);
      await Promise.all([runsResource.reload(), storageResource.reload()]);
    } catch (deletionError) {
      setActionErrorMessage(deletionError instanceof Error ? deletionError.message : String(deletionError));
    }
  };

  const modeFilterOptions: { value: ModeFilter; label: string }[] = [
    { value: ALL_FILTER_VALUE, label: "Todos" },
    { value: "text", label: "Normal" },
    { value: "expand", label: "Encadenado" },
  ];

  return (
    <div className={layoutStyles.container_general_view}>
      <div className={layoutStyles.container_view_content}>
        <header className={styles.header_storage_summary}>
          <span className={styles.icon_storage} aria-hidden="true">🗀</span>
          <div>
            <span className={styles.text_storage_caption}>Almacenamiento local</span>
            <strong className={styles.text_storage_size}>{formatBytes(storageResource.data?.total_bytes ?? 0)}</strong>
          </div>
          <StatusPill tone="success">{storageResource.data?.run_count ?? 0} tandas registradas</StatusPill>
          <StatusPill tone="info">{storageResource.data?.exported_file_count ?? 0} archivos listos (FBX / GLB)</StatusPill>
          <span className={styles.text_storage_path}>outputs/samples/</span>
        </header>

        <div className={styles.bar_history_filters}>
          <input className={styles.input_history_search} type="search" placeholder="Buscar por prompt, tanda o semilla…"
            value={searchText} onChange={(changeEvent) => setSearchText(changeEvent.target.value)} />
          <select className={styles.select_history_filter} value={assetFilter} onChange={(changeEvent) => setAssetFilter(changeEvent.target.value)}>
            <option value={ALL_FILTER_VALUE}>Personaje: todos</option>
            {assetNamesInHistory.map((assetName) => <option key={assetName} value={assetName}>{assetName}</option>)}
          </select>
          <div className={styles.container_mode_filter}>
            {modeFilterOptions.map((modeOption) => (
              <button key={modeOption.value} type="button"
                className={`${styles.button_mode_filter} ${modeFilter === modeOption.value ? styles.button_mode_filter_active : ""}`}
                onClick={() => setModeFilter(modeOption.value)}>
                {modeOption.label}
              </button>
            ))}
          </div>
          <select className={styles.select_history_filter} value={statusFilter}
            onChange={(changeEvent) => setStatusFilter(changeEvent.target.value as StatusFilter)}>
            <option value={ALL_FILTER_VALUE}>Estado: todos</option>
            <option value="completed">Completado</option>
            <option value="running">En ejecución</option>
            <option value="not_animated">Sin exportar</option>
            <option value="failed">Error</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>

        {actionErrorMessage && <InlineMessage tone="danger">{actionErrorMessage}</InlineMessage>}
        {runsResource.errorMessage && <InlineMessage tone="danger">{runsResource.errorMessage}</InlineMessage>}

        <div className={styles.container_history_table}>
          <table className={styles.table_history}>
            <thead>
              <tr>
                <th className={styles.cell_header}>Fecha / tanda</th>
                <th className={styles.cell_header}>Personaje</th>
                <th className={styles.cell_header}>Prompt</th>
                <th className={styles.cell_header}>Variantes</th>
                <th className={styles.cell_header}>Modo</th>
                <th className={styles.cell_header}>Estado</th>
                <th className={`${styles.cell_header} ${styles.cell_align_right}`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleRuns.length === 0 && (
                <tr><td colSpan={7} className={styles.cell_table_empty}>
                  {allRuns.length === 0 ? "Todavía no hay tandas." : "Ninguna tanda coincide con los filtros."}
                </td></tr>
              )}
              {visibleRuns.map((runRow) => {
                const statusPresentation = describeRunStatus(runRow.status);
                const isRunning = runRow.status === "running";
                return (
                  <tr key={runRow.run_name} className={styles.row_history}>
                    <td className={styles.cell_body}>
                      <span className={styles.text_run_name}>{runRow.run_name}</span>
                      <span className={styles.text_run_date}>{formatRunDate(runRow.created_at)}</span>
                    </td>
                    <td className={styles.cell_body}>{runRow.assets.join(", ")}</td>
                    <td className={styles.cell_body}>
                      <span className={styles.text_run_prompt}>“{runRow.prompts.join(" → ")}”</span>
                      <span className={styles.text_run_parameters}>
                        Semilla: {runRow.seed ?? "—"} · CFG: {runRow.cfg_scale ?? "—"}
                        {runRow.favorite_count > 0 && <span className={styles.text_favorite_count}> · ★ {runRow.favorite_count}</span>}
                      </span>
                    </td>
                    <td className={styles.cell_body}><span className={styles.badge_sample_count}>{runRow.sample_count} var.</span></td>
                    <td className={styles.cell_body}>
                      <span className={runRow.mode === "expand" ? styles.badge_mode_expand : styles.badge_mode_text}>
                        {runRow.mode === "expand" ? "Encadenado" : "Normal"}
                      </span>
                    </td>
                    <td className={styles.cell_body}>
                      <StatusPill tone={statusPresentation.tone} isPulsing={isRunning}>{statusPresentation.label}</StatusPill>
                    </td>
                    <td className={`${styles.cell_body} ${styles.cell_align_right}`}>
                      <div className={styles.container_row_actions}>
                        <ActionButton size="small" title="Abrir en el visor 3D" onClick={() => openRunResults(runRow.run_name)}>◎</ActionButton>
                        <ActionButton size="small" title="Relanzar (mismos parámetros, otra semilla)" disabled={isRunning}
                          onClick={() => void handleRelaunch(runRow)}>⟳</ActionButton>
                        <LinkButton size="small" href={runRow.status === "completed" ? apiClient.buildRunZipUrl(runRow.run_name, "canonical") : null}>⤓</LinkButton>
                        <ActionButton size="small" variant="ghost" title="Eliminar tanda" disabled={isRunning}
                          onClick={() => setRunPendingDeletion(runRow)}>🗑</ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog isOpen={runPendingDeletion !== null} title="¿Eliminar tanda?" confirmLabel="Eliminar" isDanger
        onConfirm={handleConfirmDeletion} onCancel={() => setRunPendingDeletion(null)}>
        Se borra la carpeta <code>outputs/samples/{runPendingDeletion?.run_name}</code> con sus movimientos, videos y GLB/FBX.
        No se puede deshacer.
      </ConfirmDialog>
    </div>
  );
}

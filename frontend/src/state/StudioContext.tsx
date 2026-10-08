import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { apiClient } from "../api/api_client";
import type { AssetInfo, SystemHealth } from "../api/api_types";
import { useApiResource } from "../hooks/useApiResource";
import { readStoredValue, writeStoredValue } from "../utils/local_storage";

export type StudioView = "characters" | "review" | "generator" | "results" | "history";

export interface ActiveGeneration {
  jobId: string;
  runName: string;
}

const HEALTH_POLL_MILLISECONDS = 4000;
const ASSETS_POLL_MILLISECONDS = 6000;
const ACTIVE_ASSET_STORAGE_KEY = "unimate_active_asset";

interface StudioContextValue {
  activeView: StudioView;
  showView: (nextView: StudioView) => void;
  assets: AssetInfo[];
  assetsErrorMessage: string | null;
  reloadAssets: () => Promise<void>;
  activeAsset: AssetInfo | null;
  selectActiveAsset: (assetName: string | null) => void;
  systemHealth: SystemHealth | null;
  healthErrorMessage: string | null;
  selectedRunName: string | null;
  openRunResults: (runName: string) => void;
  activeGeneration: ActiveGeneration | null;
  setActiveGeneration: (nextGeneration: ActiveGeneration | null) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

/** Shared app state: current screen, character list, active character, system health and selected run. */
export function StudioProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<StudioView>("characters");
  const [activeAssetName, setActiveAssetName] = useState<string | null>(() => readStoredValue(ACTIVE_ASSET_STORAGE_KEY));
  const [selectedRunName, setSelectedRunName] = useState<string | null>(null);
  const [activeGeneration, setActiveGeneration] = useState<ActiveGeneration | null>(null);

  const assetsResource = useApiResource(apiClient.fetchAssets, "assets", ASSETS_POLL_MILLISECONDS);
  const healthResource = useApiResource(apiClient.fetchHealth, "health", HEALTH_POLL_MILLISECONDS);

  /** Change the active character and remember it for the next visit. */
  const selectActiveAsset = useCallback((assetName: string | null) => {
    setActiveAssetName(assetName);
    writeStoredValue(ACTIVE_ASSET_STORAGE_KEY, assetName);
  }, []);

  /** Jump to the results screen showing one run. */
  const openRunResults = useCallback((runName: string) => {
    setSelectedRunName(runName);
    setActiveView("results");
  }, []);

  const assets = assetsResource.data ?? [];
  const activeAsset = assets.find((assetItem) => assetItem.name === activeAssetName) ?? null;

  const contextValue = useMemo<StudioContextValue>(() => ({
    activeView,
    showView: setActiveView,
    assets,
    assetsErrorMessage: assetsResource.errorMessage,
    reloadAssets: assetsResource.reload,
    activeAsset,
    selectActiveAsset,
    systemHealth: healthResource.data,
    healthErrorMessage: healthResource.errorMessage,
    selectedRunName,
    openRunResults,
    activeGeneration,
    setActiveGeneration,
  }), [activeView, assets, assetsResource.errorMessage, assetsResource.reload, activeAsset, selectActiveAsset,
    healthResource.data, healthResource.errorMessage, selectedRunName, openRunResults, activeGeneration]);

  return <StudioContext.Provider value={contextValue}>{children}</StudioContext.Provider>;
}

/** Access the shared studio state from any component. */
export function useStudio(): StudioContextValue {
  const contextValue = useContext(StudioContext);
  if (!contextValue) throw new Error("useStudio must be used inside <StudioProvider>");
  return contextValue;
}

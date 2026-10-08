import { useCallback, useEffect, useRef, useState } from "react";

interface ApiResourceState<ResourceShape> {
  data: ResourceShape | null;
  errorMessage: string | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

/**
 * Load data from the backend, reload it on demand, and optionally poll it.
 * `loadResource` is re-run whenever `dependencyKey` changes.
 */
export function useApiResource<ResourceShape>(
  loadResource: () => Promise<ResourceShape>,
  dependencyKey: string,
  pollIntervalMilliseconds?: number,
): ApiResourceState<ResourceShape> {
  const [data, setData] = useState<ResourceShape | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const latestLoaderRef = useRef(loadResource);
  latestLoaderRef.current = loadResource;

  /** Fetch the resource once and store the result or the error. */
  const reload = useCallback(async () => {
    try {
      const loadedData = await latestLoaderRef.current();
      setData(loadedData);
      setErrorMessage(null);
    } catch (loadError) {
      setErrorMessage(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    void reload();
    if (!pollIntervalMilliseconds) return undefined;
    const pollTimer = window.setInterval(() => void reload(), pollIntervalMilliseconds);
    return () => window.clearInterval(pollTimer);
  }, [dependencyKey, pollIntervalMilliseconds, reload]);

  return { data, errorMessage, isLoading, reload };
}

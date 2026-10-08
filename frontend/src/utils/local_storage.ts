// Small per-browser conveniences (remembered selections). Never required for the app to work.

/** Read a remembered string, or null when storage is unavailable or empty. */
export function readStoredValue(storageKey: string): string | null {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

/** Remember a string (or forget it when null); silently ignored if storage is blocked. */
export function writeStoredValue(storageKey: string, storedValue: string | null): void {
  try {
    if (storedValue === null) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, storedValue);
  } catch {
    // storage blocked (private window): the selection just is not remembered
  }
}

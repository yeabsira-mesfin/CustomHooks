import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
const eventName = 'resilient-hooks:storage';
type Update<T> = T | ((previous: T) => T);

/** Supply a runtime validator. Storage is not a trusted source of typed data. */
export function useStoredState<T>(key: string, fallback: T, validate: (value: unknown) => value is T) {
  const [writeError, setWriteError] = useState<string | null>(null);
  const snapshot = useCallback(() => {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }, [key]);
  const subscribe = useCallback((notify: () => void) => {
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) notify(); };
    const local = (event: Event) => { if ((event as CustomEvent<string>).detail === key) notify(); };
    window.addEventListener('storage', storage); window.addEventListener(eventName, local);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener(eventName, local); };
  }, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const decode = useCallback((text: string | null): { value: T; error: string | null } => {
    if (text === null) return { value: fallback, error: null };
    try {
      const parsed: unknown = JSON.parse(text);
      if (validate(parsed)) return { value: parsed, error: null };
    } catch { /* invalid JSON falls back safely */ }
    return { value: fallback, error: 'Stored value is invalid; using the default.' };
  }, [fallback, validate]);
  const decoded = useMemo(() => decode(raw), [decode, raw]);
  const setValue = useCallback((update: Update<T>): boolean => {
    try {
      const current = decode(snapshot()).value;
      const next = typeof update === 'function' ? (update as (previous: T) => T)(current) : update;
      if (!validate(next)) throw new Error('Value failed validation.');
      const serialized = JSON.stringify(next);
      if (serialized === undefined) throw new Error('Value cannot be serialized.');
      window.localStorage.setItem(key, serialized);
      setWriteError(null);
      window.dispatchEvent(new CustomEvent(eventName, { detail: key }));
      return true;
    } catch (error) { setWriteError(error instanceof Error ? error.message : 'Storage is unavailable.'); return false; }
  }, [decode, snapshot, validate, key]);
  return { value: decoded.value, setValue, error: writeError ?? decoded.error };
}

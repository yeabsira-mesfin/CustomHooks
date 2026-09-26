import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> = {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: T | undefined;
  error: Error | null;
  attempts: number;
};
export type AsyncOptions = { enabled?: boolean; retries?: number; delayMs?: number };

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Memoize loader with useCallback. Only retry side-effect-safe work. */
export function useAsync<T>(loader: (signal: AbortSignal) => Promise<T>, options: AsyncOptions = {}) {
  const { enabled = true } = options;
  const retries = Math.max(0, Math.min(3, Math.floor(options.retries || 0)));
  const delayMs = Math.max(0, Math.min(10000, options.delayMs ?? 250));
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle', data: undefined, error: null, attempts: 0 });
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!enabled) { setState(previous => ({ ...previous, status: 'idle', error: null, attempts: 0 })); return; }
    const controller = new AbortController();
    let active = true;
    async function run() {
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (!active) return;
        setState(previous => ({ ...previous, status: 'loading', error: null, attempts: attempt + 1 }));
        try {
          const data = await loader(controller.signal);
          if (active) setState({ status: 'success', data, error: null, attempts: attempt + 1 });
          return;
        } catch (error) {
          if (!active) return;
          if (attempt === retries) {
            setState(previous => ({ ...previous, status: 'error', error: error instanceof Error ? error : new Error(String(error)) }));
            return;
          }
          try { await pause(delayMs * 2 ** attempt, controller.signal); } catch { return; }
        }
      }
    }
    void run();
    return () => { active = false; controller.abort(); };
  }, [loader, enabled, retries, delayMs, revision]);
  return { ...state, reload };
}

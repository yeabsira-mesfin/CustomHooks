import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useAsync, useDebouncedValue, useStoredState, useOnlineStatus } from '../lib';
import { renderToString } from 'react-dom/server';
afterEach(() => { cleanup(); vi.useRealTimers(); window.localStorage.clear(); });
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

describe('useAsync', () => {
  it('ignores an old result even if the loader ignores abort', async () => {
    const old = deferred<string>(), fresh = deferred<string>();
    const loaderA = vi.fn(() => old.promise), loaderB = vi.fn(() => fresh.promise);
    const { result, rerender } = renderHook(({ loader }) => useAsync(loader), { initialProps: { loader: loaderA } });
    rerender({ loader: loaderB });
    await act(async () => fresh.resolve('new'));
    await act(async () => old.resolve('old'));
    expect(result.current.data).toBe('new');
  });
  it('aborts the active signal on unmount', () => {
    let signal: AbortSignal | undefined;
    const loader = (value: AbortSignal) => { signal = value; return new Promise<string>(() => {}); };
    const { unmount } = renderHook(() => useAsync(loader));
    unmount(); expect(signal?.aborted).toBe(true);
  });
  it('retries with backoff and stops at the configured attempt limit', async () => {
    vi.useFakeTimers(); const loader = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAsync(loader, { retries: 2, delayMs: 50 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(49); }); expect(loader).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); }); expect(loader).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(loader).toHaveBeenCalledTimes(3); expect(result.current.status).toBe('error');
    expect(result.current.attempts).toBe(3);
  });
  it('cancels retry timers on cleanup', async () => {
    vi.useFakeTimers(); const loader = vi.fn().mockRejectedValue(new Error('offline'));
    const { unmount } = renderHook(() => useAsync(loader, { retries: 3 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); }); unmount();
    await act(async () => { await vi.runAllTimersAsync(); }); expect(loader).toHaveBeenCalledTimes(1);
  });
  it('does not run while disabled and supports manual reload', async () => {
    const loader = vi.fn().mockResolvedValue('ok');
    const { result, rerender } = renderHook(({ enabled }) => useAsync(loader, { enabled }), { initialProps: { enabled: false } });
    expect(loader).not.toHaveBeenCalled(); rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe('success'));
    act(() => result.current.reload());
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
  });
});
it('debounces rapid value changes without emitting intermediate values', async () => {
  vi.useFakeTimers(); const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), { initialProps: { value: 'a' } });
  rerender({ value: 'b' }); await act(async () => { await vi.advanceTimersByTimeAsync(60); }); rerender({ value: 'c' });
  await act(async () => { await vi.advanceTimersByTimeAsync(99); }); expect(result.current).toBe('a');
  await act(async () => { await vi.advanceTimersByTimeAsync(1); }); expect(result.current).toBe('c');
});
describe('useStoredState', () => {
  it('synchronizes same-tab consumers and functional updates', () => {
    const a = renderHook(() => useStoredState('count', 0, isNumber));
    const b = renderHook(() => useStoredState('count', 0, isNumber));
    act(() => { a.result.current.setValue(v => v + 1); a.result.current.setValue(v => v + 1); });
    expect(a.result.current.value).toBe(2); expect(b.result.current.value).toBe(2);
  });
  it('changes keys without overwriting the destination', () => {
    localStorage.setItem('a', '1'); localStorage.setItem('b', '7');
    const { result, rerender } = renderHook(({ key }) => useStoredState(key, 0, isNumber), { initialProps: { key: 'a' } });
    rerender({ key: 'b' }); expect(result.current.value).toBe(7); expect(localStorage.getItem('b')).toBe('7');
  });
  it('rejects corrupt or wrongly typed stored values', () => {
    localStorage.setItem('broken', '"wrong type"');
    const { result } = renderHook(() => useStoredState('broken', 3, isNumber));
    expect(result.current.value).toBe(3); expect(result.current.error).toMatch(/invalid/);
  });
  it('surfaces quota failures without claiming a successful write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    const { result } = renderHook(() => useStoredState('quota', 0, isNumber));
    act(() => { expect(result.current.setValue(2)).toBe(false); });
    expect(result.current.value).toBe(0); expect(result.current.error).toBe('Quota exceeded');
  });
  it('reacts to cross-tab storage events and clear events', () => {
    const { result } = renderHook(() => useStoredState('shared', 0, isNumber));
    act(() => { localStorage.setItem('shared', '9'); window.dispatchEvent(new StorageEvent('storage', { key: 'shared' })); });
    expect(result.current.value).toBe(9);
    act(() => { localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key: null })); });
    expect(result.current.value).toBe(0);
  });
});
it('observes browser online and offline hints', () => {
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const { result } = renderHook(() => useOnlineStatus());
  act(() => { online.mockReturnValue(false); window.dispatchEvent(new Event('offline')); });
  expect(result.current).toBe(false);
});
it('uses deterministic defaults during server rendering', () => {
  function Sample() { const state = useStoredState('ssr', 4, isNumber); const online = useOnlineStatus(); return <span>{state.value}:{String(online)}</span>; }
  expect(renderToString(<Sample />)).toContain('4');
});

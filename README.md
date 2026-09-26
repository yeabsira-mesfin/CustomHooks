# Resilient React Hooks

Four small TypeScript hooks for predictable React interfaces, with an interactive failure simulator and focused regression tests.

## Quick start

Requires Node.js 24+.

```sh
npm ci
npm test
npm run typecheck
npm run build        # ESM library and declaration files in dist/
npm run dev          # interactive demo; open the Vite URL
npm run build:demo   # static demo in demo-dist/
```

React is a peer dependency and is not bundled. The repository is public, but the package is deliberately private and has **not** been published to npm. Import from `lib` while exploring the source or from the generated `dist/index.js` in a local integration.

## Hooks

| Hook | Contract |
| --- | --- |
| `useAsync(loader, options)` | Abort superseded work; ignore late results; bounded opt-in retries; manual reload |
| `useDebouncedValue(value, delayMs)` | Publish the latest value after the quiet period; cancel old timers |
| `useStoredState(key, fallback, validate)` | Validated JSON storage, same-tab/cross-tab synchronization, write errors, SSR fallback |
| `useOnlineStatus()` | Browser connectivity hint with a deterministic server snapshot |

```tsx
const query = useDebouncedValue(search, 300);
const loader = useCallback(async (signal: AbortSignal) => {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) throw new Error(`Search failed: ${response.status}`);
  return response.json();
}, [query]);
const { data, status, error, attempts, reload } = useAsync(loader, {
  retries: 2,
  delayMs: 250,
});
```

Memoize the loader. Only opt into retries for work safe to repeat. Automatic retries default to zero and are capped at three retries (four attempts), with exponential delays. `enabled: false` cancels active work and sets idle status. Existing data remains visible during reload or failure. Cleanup still guards the state when a loader ignores its AbortSignal.

```tsx
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const counter = useStoredState('counter', 0, isNumber);
const saved = counter.setValue(previous => previous + 1);
// saved is false on a quota, serialization, validation, or access error.
```

## Demo

The demo searches a synthetic service catalog. Type rapidly with high latency to exercise cancellation. Turn on failure mode to observe the retry limit. Toggle density to see two independent subscribers synchronize through browser storage. Open a second tab to explore storage events. No external API or key is required.

## Verification

Thirteen tests cover stale responses, abort signals, retry timing and limits, retry cleanup, disabled/reload behavior, debounce, functional storage updates, changing keys, corrupt data, quota failure, storage events, connectivity, and server rendering. CI tests React 18.3.1 and 19.3.0, checks types, and builds both library and demo.

[Design trade-offs](docs/design.md)

## Scope and provenance

This is a focused learning and portfolio library, not a replacement for a full query cache. It does not provide request deduplication, distributed consistency, caching policies, or offline mutation queues. `navigator.onLine` is a hint, not an API health probe. Stored values are not encrypted and should not contain credentials.

The repository evolved from the CustomHooks/PlacePicker exercise. Historical code remains in Git history. The current API, implementation, typed contracts, tests, and interactive lab replace that scaffold.

# Design decisions

## Async lifecycle

Each effect owns an AbortController and an active flag. Cleanup invalidates both. The flag is necessary because third-party loaders can ignore cancellation. The previous successful data remains available while status is loading or error; consumers can choose whether to show stale data. Requests are not cached or deduplicated.

The loader's identity is the effect dependency, so useCallback is part of the caller contract. Retries are opt-in and apply to every loader rejection. A caller that distinguishes retryable HTTP status codes should do that in its loader or keep retries at zero. There is no jitter or Retry-After handling in this small implementation.

## Browser storage

useSyncExternalStore reads a stable raw string snapshot. Parsing and validation happen separately. A custom event notifies same-document consumers; native storage events notify other tabs. Key changes subscribe to a different store without writing the old value to the new key. The server snapshot is null, so the initial server render uses the fallback without accessing window.

Functional updates read the latest storage value in the current tab. They are not atomic across tabs: concurrent cross-tab writes are last-writer-wins. Storage access failure returns the fallback, while failed writes return false and expose an error. A validator protects the boundary between persisted JSON and TypeScript assumptions.

## Tests

Fake timers verify temporal behavior and retry cleanup without long delays. Deferred promises intentionally complete out of order. The stale-result test proves the active flag matters even when the underlying loader ignores AbortSignal. Type checking and build outputs are separate from runtime assertions.

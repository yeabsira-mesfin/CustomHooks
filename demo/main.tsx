import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useAsync, useDebouncedValue, useOnlineStatus, useStoredState } from '../lib';
import './style.css';

type Density = 'comfortable' | 'compact';
const isDensity = (value: unknown): value is Density => value === 'comfortable' || value === 'compact';
const services = [
  { name: 'Identity gateway', team: 'Platform', region: 'us-east' },
  { name: 'Orders API', team: 'Commerce', region: 'us-west' },
  { name: 'Events pipeline', team: 'Data', region: 'eu-west' },
  { name: 'Search index', team: 'Discovery', region: 'us-east' },
];
function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
  });
}
function StorageMirror() {
  const preference = useStoredState<Density>('hooks:density', 'comfortable', isDensity);
  return <p className="mirror">Independent subscriber: <strong>{preference.value}</strong></p>;
}
function App() {
  const [query, setQuery] = useState(''), [latency, setLatency] = useState(700), [fail, setFail] = useState(false);
  const debounced = useDebouncedValue(query, 350), online = useOnlineStatus();
  const density = useStoredState<Density>('hooks:density', 'comfortable', isDensity);
  const loader = useCallback(async (signal: AbortSignal) => {
    await pause(latency, signal);
    if (fail) throw new Error('Simulated service failure. Turn off failure mode and retry.');
    return { query: debounced, rows: services.filter(s => `${s.name} ${s.team}`.toLowerCase().includes(debounced.toLowerCase())) };
  }, [debounced, latency, fail]);
  const request = useAsync(loader, { retries: 2, delayMs: 250 });
  return <div className="shell"><header><span className="brand">rh<span>/</span></span><span>Resilient Hooks</span><a href="https://github.com/yeabsira-mesfin/resilient-react-hooks">Source ↗</a></header><main><div className="intro"><p className="eyebrow">THE INTERACTIVE LAB</p><h1>Small hooks.<br/><span>Stronger interfaces.</span></h1><p>Explore request cancellation, controlled retries, and synchronized preferences in a deterministic local demo.</p><div className="chips"><span>TypeScript</span><span>React 18 / 19</span><span>Zero runtime dependencies beyond React</span></div></div>
    <div className="grid"><section className="panel"><div className="panelhead"><span className="number">01</span><div><h2>Request playground</h2><p>useAsync + useDebouncedValue</p></div><span className={`status ${request.status}`}>{request.status}</span></div><label>Find a service<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Try typing ‘orders’ quickly…"/></label><div className="controls"><label>Simulated latency: {latency} ms<input type="range" min="100" max="2000" step="100" value={latency} onChange={e => setLatency(Number(e.target.value))}/></label><label className="check"><input type="checkbox" checked={fail} onChange={e => setFail(e.target.checked)}/> Fail requests</label><button onClick={request.reload}>Reload ↻</button></div><div className="telemetry"><div><span>RAW INPUT</span><code>{query || '(empty)'}</code></div><div><span>DEBOUNCED</span><code>{debounced || '(empty)'}</code></div><div><span>ATTEMPT</span><code>{request.attempts} / 3</code></div></div>
      {request.error && <p role="alert" className="error">{request.error.message}</p>}<div className={`results ${density.value}`} aria-live="polite">{request.status === 'loading' && <p className="loading">Loading results{request.data ? ' · keeping the previous data visible' : ''}…</p>}{request.data && <><p className="resultlabel">Results for {request.data.query ? `“${request.data.query}”` : 'all services'} · synthetic catalog</p>{request.data.rows.map((s, i) => <article key={s.name}><span className="serviceicon">0{i + 1}</span><div><strong>{s.name}</strong><small>{s.team} team</small></div><span className="region">{s.region}</span></article>)}{!request.data.rows.length && <p>No services match this search.</p>}</>}</div><p className="footnote">Change the search before a request finishes. Superseded work is aborted, and late responses cannot replace newer results.</p></section>
    <aside><section className="panel"><div className="panelhead"><span className="number">02</span><div><h2>Shared preference</h2><p>useStoredState</p></div></div><p className="bodycopy">Both subscribers and other tabs update when this preference changes.</p><div className="density">{(['comfortable', 'compact'] as Density[]).map(value => <button aria-pressed={density.value === value} key={value} onClick={() => density.setValue(value)}>{value}</button>)}</div><StorageMirror/>{density.error && <p role="alert" className="error">{density.error}</p>}</section><section className="panel"><div className="panelhead"><span className="number">03</span><div><h2>Browser connectivity</h2><p>useOnlineStatus</p></div></div><div className="connectivity"><i className={online ? 'online' : ''}/>{online ? 'Browser reports online' : 'Browser reports offline'}</div><p className="bodycopy">A connectivity hint from the browser. This does not prove that an API is reachable.</p></section><section className="tip"><p className="eyebrow">TRY AN EDGE CASE</p><h3>Watch retries happen.</h3><p>Enable failure mode. The hook makes at most three attempts, then shows the error. Turn it off to recover.</p></section></aside></div></main><footer>Resilient React Hooks · No API key or external service required</footer></div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

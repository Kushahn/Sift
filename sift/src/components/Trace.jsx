import { inkFor } from "../lib/store.js";

export default function Trace({ trace, asking, onDismiss, theme }) {
  const maxScore = Math.max(1, ...trace.res.rows.map((r) => r.score));
  return (
    <div className="trace" aria-live="polite">
      <div className="tr-top">
        <span>ROUTING TRACE · "{trace.text}"</span>
        <button className="x" onClick={onDismiss} aria-label="Dismiss trace">×</button>
      </div>
      {trace.res.rows.map((r) => (
        <div className="tr-row" key={r.cat.id}>
          <span className="tr-name">{r.cat.name}</span>
          <span className="tr-bar">
            <span style={{ width: (r.score / maxScore) * 100 + "%", background: inkFor(r.cat.color, theme) }} />
          </span>
          <span className="tr-score">{r.score.toFixed(1)}</span>
          <span className="tr-match">{r.matched.length ? r.matched.map((m) => `'${m}'`).join(" ") : "·"}</span>
        </div>
      ))}
      <div className="tr-verdict">
        {asking
          ? "→ no confident match — asking the operator"
          : `→ filed under ${trace.res.best.cat.name} · ${trace.res.confidence}% confident`}
      </div>
    </div>
  );
}

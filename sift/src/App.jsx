import { useEffect, useMemo, useRef, useState } from "react";
import { classify, suggestName, POLICY } from "./lib/classifier.js";
import { load, save, freshSeeds, TRAY_COLORS } from "./lib/store.js";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const stamp = () =>
  new Date().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

// deterministic tiny tilt per item, like cards dropped into a tray
function tilt(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return ((h % 5) - 2) * 0.35 + "deg";
}

const EXAMPLES = {
  personal: ["dentist friday at 3pm", "what if alarms snoozed themselves", "fix the squeaky door", "quantum sandwich logistics"],
  corporate: ["team sync tomorrow at 10am", "thoughts on renaming the API?", "ship onboarding by Q3", "quantum sandwich logistics"],
};

const RegMark = () => (
  <svg className="regmark" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10 0v20 M0 10h20" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export default function App() {
  const [state, setState] = useState(load);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [trace, setTrace] = useState(null);     // { text, res }
  const [pending, setPending] = useState(null); // { text, name }
  const [toast, setToast] = useState(null);     // { id, tray, conf }
  const [newTray, setNewTray] = useState(null);  // string while typing, null hidden
  const [editTray, setEditTray] = useState(null); // { id, name }
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => save(state), [state]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const mode = state.active;
  const ws = state.workspaces[mode];

  const patchWs = (fn) =>
    setState((s) => ({
      ...s,
      workspaces: { ...s.workspaces, [s.active]: fn(s.workspaces[s.active]) },
    }));

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ws.items.filter((it) => it.text.toLowerCase().includes(q)) : ws.items;
  }, [ws.items, query]);

  // ---- capture & routing -------------------------------------------------

  function fileItem(text, catId, conf) {
    const item = { id: uid(), catId, text, conf, ts: stamp(), done: false };
    patchWs((w) => ({ ...w, items: [item, ...w.items] }));
    return item;
  }

  function pushToast(item, trayName, conf) {
    clearTimeout(toastTimer.current);
    setToast({ id: item.id, tray: trayName, conf });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  function route() {
    const text = input.trim();
    if (!text) return;
    const res = classify(text, ws.categories);
    setTrace({ text, res });
    setPending(null);
    if (res.confidence >= POLICY.auto) {
      fileItem(text, res.best.cat.id, res.confidence);
    } else if (res.confidence >= POLICY.ask) {
      const item = fileItem(text, res.best.cat.id, res.confidence);
      pushToast(item, res.best.cat.name, res.confidence);
    } else {
      setPending({ text, name: suggestName(text) });
    }
    setInput("");
    if (inputRef.current) inputRef.current.focus();
  }

  function undoToast() {
    if (!toast) return;
    patchWs((w) => ({ ...w, items: w.items.filter((it) => it.id !== toast.id) }));
    setToast(null);
  }

  // ---- pending (new tray suggestion) -------------------------------------

  function createTrayForPending() {
    if (!pending || !pending.name.trim()) return;
    const name = pending.name.trim();
    const cat = {
      id: "t" + uid(),
      name,
      color: TRAY_COLORS[ws.categories.length % TRAY_COLORS.length],
      words: [name.toLowerCase()],
    };
    const item = { id: uid(), catId: cat.id, text: pending.text, conf: null, ts: stamp(), done: false };
    // single atomic update — no setTimeout races
    patchWs((w) => ({ ...w, categories: [...w.categories, cat], items: [item, ...w.items] }));
    setPending(null);
  }

  function filePendingUnder(catId) {
    if (!pending || !catId) return;
    fileItem(pending.text, catId, null);
    setPending(null);
  }

  // ---- trays ---------------------------------------------------------------

  function addTray() {
    const name = (newTray || "").trim();
    if (!name) return setNewTray(null);
    const cat = {
      id: "t" + uid(),
      name,
      color: TRAY_COLORS[ws.categories.length % TRAY_COLORS.length],
      words: [name.toLowerCase()],
    };
    patchWs((w) => ({ ...w, categories: [...w.categories, cat] }));
    setNewTray(null);
  }

  function commitRename() {
    if (!editTray) return;
    const name = editTray.name.trim();
    if (name) {
      patchWs((w) => ({
        ...w,
        categories: w.categories.map((c) => (c.id === editTray.id ? { ...c, name } : c)),
      }));
    }
    setEditTray(null);
  }

  function deleteTray(id) {
    if (ws.categories.length <= 1) return;
    const target = ws.categories.find((c) => c.id === id);
    const count = ws.items.filter((it) => it.catId === id).length;
    if (count && !window.confirm(`Move ${count} item(s) out of "${target.name}" and remove the tray?`)) return;
    patchWs((w) => {
      const rest = w.categories.filter((c) => c.id !== id);
      const fallback = rest[0].id;
      return {
        ...w,
        categories: rest,
        items: w.items.map((it) => (it.catId === id ? { ...it, catId: fallback, refiled: true } : it)),
      };
    });
  }

  // ---- items ----------------------------------------------------------------

  const refile = (itemId, catId) =>
    patchWs((w) => ({
      ...w,
      items: w.items.map((it) => (it.id === itemId ? { ...it, catId, refiled: true } : it)),
    }));

  const toggleDone = (itemId) =>
    patchWs((w) => ({
      ...w,
      items: w.items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)),
    }));

  const removeItem = (itemId) =>
    patchWs((w) => ({ ...w, items: w.items.filter((it) => it.id !== itemId) }));

  // ---- workspace / data -------------------------------------------------------

  function switchMode(next) {
    if (next === mode) return;
    setState((s) => ({ ...s, active: next }));
    setTrace(null);
    setPending(null);
    setToast(null);
    setQuery("");
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sift-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || !data.workspaces || !data.active) throw new Error("bad shape");
        setState(data);
      } catch {
        window.alert("That file does not look like a Sift export.");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  }

  function resetAll() {
    if (window.confirm("Erase everything on this device and restore demo data?")) {
      setState(freshSeeds());
      setTrace(null);
      setPending(null);
      setToast(null);
    }
  }

  // ---- render ------------------------------------------------------------------

  const maxScore = trace ? Math.max(1, ...trace.res.rows.map((r) => r.score)) : 1;
  const asking = trace && (trace.res.total === 0 || trace.res.confidence < POLICY.ask);

  return (
    <div className="sift">
      <header className="top">
        <div className="brand">
          <span className="wordmark">SIFT</span>
          <RegMark />
          <span className="tag">type anything — it finds its place</span>
        </div>
        <div className="seg" role="group" aria-label="Edition">
          {["personal", "corporate"].map((m) => (
            <button
              key={m}
              className={"segbtn" + (mode === m ? " on" : "")}
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <div className="capture">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && route()}
          placeholder={
            mode === "personal"
              ? "buy a power strip… what if… dentist friday 3pm…"
              : "should we rename the API… standup at 9:30… ship by Q3…"
          }
          aria-label="Capture input"
          enterKeyHint="send"
        />
        <button className="btn go" onClick={route}>route it</button>
      </div>

      <div className="examples">
        {EXAMPLES[mode].map((ex) => (
          <button
            key={ex}
            className="chip"
            onClick={() => {
              setInput(ex);
              if (inputRef.current) inputRef.current.focus();
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {trace && (
        <div className="trace" aria-live="polite">
          <div className="tr-top">
            <span>ROUTING TRACE · "{trace.text}"</span>
            <button className="x" onClick={() => setTrace(null)} aria-label="Dismiss trace">×</button>
          </div>
          {trace.res.rows.map((r) => (
            <div className="tr-row" key={r.cat.id}>
              <span className="tr-name">{r.cat.name}</span>
              <span className="tr-bar">
                <span style={{ width: (r.score / maxScore) * 100 + "%", background: r.cat.color }} />
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
      )}

      {pending && (
        <div className="suggest">
          <div className="sg-text">
            Nothing fits <b>"{pending.text}"</b>. New tray?
          </div>
          <div className="sg-row">
            <input
              value={pending.name}
              onChange={(e) => setPending({ ...pending, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && createTrayForPending()}
              aria-label="New tray name"
            />
            <button className="btn" onClick={createTrayForPending}>
              create "{pending.name.trim() || "…"}"
            </button>
            <select value="" onChange={(e) => filePendingUnder(e.target.value)} aria-label="File under existing tray">
              <option value="" disabled>…or file under</option>
              {ws.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button className="ghost" onClick={() => setPending(null)}>discard</button>
          </div>
        </div>
      )}

      <div className="toolbar">
        <input
          className="filter"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter items…"
          aria-label="Filter items"
        />
        <span className="spacer" />
        {newTray === null ? (
          <button className="ghost" onClick={() => setNewTray("")}>+ tray</button>
        ) : (
          <span className="newtray">
            <input
              autoFocus
              value={newTray}
              onChange={(e) => setNewTray(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTray();
                if (e.key === "Escape") setNewTray(null);
              }}
              placeholder="tray name"
              aria-label="New tray name"
            />
            <button className="btn" onClick={addTray}>add</button>
          </span>
        )}
        <button className="ghost" onClick={exportJSON}>export</button>
        <button className="ghost" onClick={() => fileRef.current && fileRef.current.click()}>import</button>
        <input ref={fileRef} type="file" accept="application/json" onChange={importJSON} hidden />
        <button className="ghost danger" onClick={resetAll}>reset</button>
      </div>

      <div className="board">
        {ws.categories.map((c) => {
          const list = visibleItems.filter((it) => it.catId === c.id);
          return (
            <section className="tray" key={c.id} style={{ "--c": c.color }}>
              <header className="tray-head">
                <span className="drum" aria-hidden="true" />
                {editTray && editTray.id === c.id ? (
                  <input
                    autoFocus
                    className="rename"
                    value={editTray.name}
                    onChange={(e) => setEditTray({ ...editTray, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditTray(null);
                    }}
                    onBlur={commitRename}
                    aria-label="Rename tray"
                  />
                ) : (
                  <button className="tray-name" onClick={() => setEditTray({ id: c.id, name: c.name })} title="Rename">
                    {c.name}
                  </button>
                )}
                <span className="count">{list.length}</span>
                {ws.categories.length > 1 && (
                  <button className="x" onClick={() => deleteTray(c.id)} aria-label={`Delete tray ${c.name}`}>×</button>
                )}
              </header>

              {list.length === 0 && <div className="empty">empty — type above</div>}

              {list.map((it) => (
                <article className={"card" + (it.done ? " done" : "")} key={it.id} style={{ "--tilt": tilt(it.id) }}>
                  <div className="card-row">
                    <button className="check" onClick={() => toggleDone(it.id)} aria-label={it.done ? "Mark not done" : "Mark done"}>
                      {it.done ? "■" : "□"}
                    </button>
                    <p>{it.text}</p>
                  </div>
                  <footer>
                    <span className="meta">
                      {it.ts} · {it.conf == null ? "manual" : it.conf + "%"}
                      {it.refiled ? " · refiled" : ""}
                    </span>
                    <span className="acts">
                      <select value={it.catId} onChange={(e) => refile(it.id, e.target.value)} aria-label="Move item">
                        {ws.categories.map((cc) => (
                          <option key={cc.id} value={cc.id}>{cc.name}</option>
                        ))}
                      </select>
                      <button className="x" onClick={() => removeItem(it.id)} aria-label="Delete item">×</button>
                    </span>
                  </footer>
                </article>
              ))}
            </section>
          );
        })}
      </div>

      {toast && (
        <div className="toast" role="status">
          filed under <b>{toast.tray}</b> · {toast.conf}% sure
          <button className="btn small" onClick={undoToast}>undo</button>
        </div>
      )}

      <footer className="foot">
        rule-based router v1 · swap in src/lib/classifier.js · data lives on this device · refiles become training signals
      </footer>
    </div>
  );
}

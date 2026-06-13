import { useEffect, useMemo, useRef, useState } from "react";
import { classify, suggestName, POLICY } from "./lib/classifier.js";
import { parseDue } from "./lib/dates.js";
import { load, save, freshSeeds, normalize, TRAY_COLORS } from "./lib/store.js";
import Capture from "./components/Capture.jsx";
import Trace from "./components/Trace.jsx";
import PendingSlip from "./components/PendingSlip.jsx";
import Toolbar from "./components/Toolbar.jsx";
import Board from "./components/Board.jsx";
import Toast from "./components/Toast.jsx";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const stamp = () =>
  new Date().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const RegMark = () => (
  <svg className="regmark" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10 0v20 M0 10h20" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const newItem = (text, catId, conf) => {
  const parsed = parseDue(text);
  return {
    id: uid(), catId, text, conf, ts: stamp(), done: false, created: Date.now(),
    due: parsed?.due ?? null,
    hasTime: parsed?.hasTime ?? false,
    vague: parsed?.vague ?? false,
    repeat: null,
    remind: !!(parsed && parsed.due != null), // concrete date -> reminder armed by default
    doneAt: null, notifiedAt: null,
  };
};

export default function App() {
  const [data, setData] = useState(load);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("new"); // "new" | "due"
  const [trace, setTrace] = useState(null);     // { text, res }
  const [pending, setPending] = useState(null); // { text, name }
  const [toast, setToast] = useState(null);     // { text, undoId? }
  const inputRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => save(data), [data]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? data.items.filter((it) => it.text.toLowerCase().includes(q)) : data.items;
  }, [data.items, query]);

  function pushToast(next) {
    clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  // ---- capture & routing -------------------------------------------------

  function route() {
    const text = input.trim();
    if (!text) return;
    const res = classify(text, data.categories);
    setTrace({ text, res });
    setPending(null);
    if (res.confidence >= POLICY.auto) {
      setData((d) => ({ ...d, items: [newItem(text, res.best.cat.id, res.confidence), ...d.items] }));
    } else if (res.confidence >= POLICY.ask) {
      const item = newItem(text, res.best.cat.id, res.confidence);
      setData((d) => ({ ...d, items: [item, ...d.items] }));
      pushToast({ text: `filed under ${res.best.cat.name} · ${res.confidence}% sure`, undoId: item.id });
    } else {
      setPending({ text, name: suggestName(text) });
    }
    setInput("");
    inputRef.current?.focus();
  }

  function undo(id) {
    setData((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));
    setToast(null);
  }

  // ---- pending slip --------------------------------------------------------

  function createTrayForPending(name) {
    const trimmed = (name || "").trim();
    if (!pending || !trimmed) return;
    const cat = {
      id: "t" + uid(), name: trimmed,
      color: TRAY_COLORS[data.categories.length % TRAY_COLORS.length],
      words: [trimmed.toLowerCase()],
    };
    setData((d) => ({
      ...d,
      categories: [...d.categories, cat],
      items: [newItem(pending.text, cat.id, null), ...d.items],
    }));
    setPending(null);
  }

  function filePendingUnder(catId) {
    if (!pending || !catId) return;
    setData((d) => ({ ...d, items: [newItem(pending.text, catId, null), ...d.items] }));
    setPending(null);
  }

  // ---- trays ---------------------------------------------------------------

  function addTray(name) {
    const cat = {
      id: "t" + uid(), name,
      color: TRAY_COLORS[data.categories.length % TRAY_COLORS.length],
      words: [name.toLowerCase()],
    };
    setData((d) => ({ ...d, categories: [...d.categories, cat] }));
  }

  const renameTray = (id, name) =>
    setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, name } : c)) }));

  function deleteTray(id) {
    if (data.categories.length <= 1) return;
    const target = data.categories.find((c) => c.id === id);
    const count = data.items.filter((it) => it.catId === id).length;
    if (count && !window.confirm(`Move ${count} item(s) out of "${target.name}" and remove the tray?`)) return;
    setData((d) => {
      const rest = d.categories.filter((c) => c.id !== id);
      return {
        ...d,
        categories: rest,
        items: d.items.map((it) => (it.catId === id ? { ...it, catId: rest[0].id, refiled: true } : it)),
      };
    });
  }

  // ---- items ----------------------------------------------------------------

  const patchItem = (id, fn) =>
    setData((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? fn(it) : it)) }));

  const refile = (id, catId) => patchItem(id, (it) => ({ ...it, catId, refiled: true }));

  const toggleDone = (id) =>
    patchItem(id, (it) => ({ ...it, done: !it.done, doneAt: !it.done ? Date.now() : null }));

  const removeItem = (id) => setData((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));

  // ---- data -----------------------------------------------------------------

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sift-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        setData(normalize(JSON.parse(r.result)));
      } catch {
        window.alert("That file does not look like a Sift export.");
      }
    };
    r.readAsText(file);
  }

  function resetAll() {
    if (window.confirm("Erase everything on this device and restore demo data?")) {
      setData(freshSeeds());
      setTrace(null);
      setPending(null);
      setToast(null);
    }
  }

  // ---- render ----------------------------------------------------------------

  const asking = trace && (trace.res.total === 0 || trace.res.confidence < POLICY.ask);

  return (
    <div className="sift">
      <header className="top">
        <div className="brand">
          <span className="wordmark">SIFT</span>
          <RegMark />
          <span className="tag">type anything — it finds its place</span>
        </div>
      </header>

      <Capture input={input} setInput={setInput} onRoute={route} inputRef={inputRef} />

      {trace && <Trace trace={trace} asking={asking} onDismiss={() => setTrace(null)} />}

      {pending && (
        <PendingSlip
          pending={pending} setPending={setPending} categories={data.categories}
          onCreate={createTrayForPending} onFileUnder={filePendingUnder} onDiscard={() => setPending(null)}
        />
      )}

      <Toolbar
        query={query} setQuery={setQuery}
        onAddTray={addTray} onExport={exportJSON} onImport={importJSON} onReset={resetAll}
        sort={sort} setSort={setSort}
      />

      <Board
        categories={data.categories} items={visibleItems} canDelete={data.categories.length > 1}
        onRenameTray={renameTray} onDeleteTray={deleteTray}
        onToggleDone={toggleDone} onRefile={refile} onRemove={removeItem}
        sort={sort}
      />

      {toast && <Toast toast={toast} onUndo={undo} />}

      <footer className="foot">
        rule-based router v1 · swap in src/lib/classifier.js · data lives on this device · refiles become training signals
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { isExt, getOpenMode, setOpenMode } from "../lib/ext.js";

// Extension only: how the toolbar icon opens Sift. The background script
// watches this setting and re-wires the icon accordingly.
function OpenModeRow() {
  const [mode, setMode] = useState(null);
  useEffect(() => { getOpenMode().then(setMode); }, []);
  if (!isExt || mode == null) return null;
  return (
    <label className="openmode">
      <span>opens in</span>
      <select value={mode} onChange={(e) => { setMode(e.target.value); setOpenMode(e.target.value); }}>
        <option value="tab">tab</option>
        <option value="sidebar">sidebar</option>
        <option value="popup">popup</option>
      </select>
    </label>
  );
}

export default function Toolbar({ query, setQuery, onAddTray, onExport, onImport, onReset, sort, setSort, doneCount, onClearDone }) {
  const [newTray, setNewTray] = useState(null);
  const fileRef = useRef(null);
  const menuRef = useRef(null);

  function commit() {
    const name = (newTray || "").trim();
    if (name) onAddTray(name);
    setNewTray(null);
  }

  return (
    <div className="toolbar">
      <input
        className="filter"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="filter items…"
        aria-label="Filter items"
      />
      <span className="spacer" />
      <button
        className="ghost"
        onClick={() => setSort(sort === "new" ? "due" : "new")}
        aria-label="Toggle sort order"
      >
        sort: {sort === "new" ? "newest" : "due"}
      </button>
      {doneCount > 0 && (
        <button className="ghost" onClick={onClearDone}>clear done ({doneCount})</button>
      )}
      {newTray === null ? (
        <button className="ghost" onClick={() => setNewTray("")}>+ tray</button>
      ) : (
        <span className="newtray">
          <input
            autoFocus
            value={newTray}
            onChange={(e) => setNewTray(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setNewTray(null);
            }}
            placeholder="tray name"
            aria-label="New tray name"
          />
          <button className="btn" onClick={commit}>add</button>
        </span>
      )}
      <details className="menu" ref={menuRef}>
        <summary>data</summary>
        <div className="menu-pop" onClick={() => menuRef.current?.removeAttribute("open")}>
          <OpenModeRow />
          <button className="ghost" onClick={onExport}>export</button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>import</button>
          <button className="ghost danger" onClick={onReset}>reset</button>
        </div>
      </details>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }}
        hidden
      />
    </div>
  );
}

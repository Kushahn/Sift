import { useState, useRef } from "react";

// ---------- mock classifier (production: swap this module for the Claude API service) ----------

const PALETTE = ["#2F7D5B", "#6C4FD8", "#2B6CB0", "#C2701E", "#B23A6B", "#0F7E8C", "#8A5A00"];

const LEX = {
  tasks: {
    words: ["buy", "fix", "finish", "submit", "send", "pay", "clean", "renew", "book", "remind", "need to", "have to", "todo", "don't forget", "pick up", "order", "return", "install", "call", "email"],
    patterns: [],
  },
  ideas: {
    words: ["idea", "what if", "concept", "imagine", "feature", "maybe we", "could build", "an app", "startup", "prototype", "wouldn't it be", "game where"],
    patterns: [],
  },
  plans: {
    words: ["plan", "roadmap", "strategy", "goal", "milestone", "long term", "save up", "learn", "prepare for", "apply to", "by next", "this year", "budget"],
    patterns: [/\bby q[1-4]\b/],
  },
  events: {
    words: ["meeting", "meet ", "tomorrow", "today", "tonight", "next week", "schedule", "appointment", "deadline", "lunch", "dinner", "interview", "standup", "sync", "all-hands"],
    patterns: [/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/, /\bat\s+\d{1,2}\b/, /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/, /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/],
  },
  brainstorm: {
    words: ["brainstorm", "thoughts on", "let's discuss", "open question", "team input", "vote", "poll", "feedback on", "pitch", "naming", "should we"],
    patterns: [],
  },
};

function classify(text, categories) {
  const t = " " + text.toLowerCase() + " ";
  const rows = categories.map((c) => {
    const lex = c.lexicon ? LEX[c.lexicon] : { words: c.words || [c.name.toLowerCase()], patterns: [] };
    const matched = new Set();
    let score = 0;
    for (const w of lex.words) if (t.includes(w)) { matched.add(w.trim()); score += 1; }
    for (const p of lex.patterns) { const m = t.match(p); if (m) { matched.add(m[0].trim()); score += 1.5; } }
    return { cat: c, score, matched: [...matched] };
  });
  const total = rows.reduce((s, r) => s + r.score, 0);
  const best = [...rows].sort((a, b) => b.score - a.score)[0];
  const dominance = total ? best.score / total : 0;
  const strength = 1 - Math.exp(-(best ? best.score : 0) / 1.6);
  return { rows, best, total, confidence: Math.round(dominance * strength * 100) };
}

const STOP = new Set(["the", "and", "for", "with", "that", "this", "about", "from", "into", "should", "would", "could", "need", "want", "have", "will", "make", "just", "some", "more", "what", "when", "where", "then", "them", "they", "over", "under", "every", "really"]);
function suggestName(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/gi, "").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
  const pick = words.sort((a, b) => b.length - a.length)[0] || "misc";
  return pick.charAt(0).toUpperCase() + pick.slice(1);
}

// ---------- seed data ----------

const INITIAL = {
  personal: {
    categories: [
      { id: "tasks", name: "Tasks", lexicon: "tasks", color: PALETTE[0] },
      { id: "ideas", name: "Ideas", lexicon: "ideas", color: PALETTE[1] },
      { id: "plans", name: "Plans", lexicon: "plans", color: PALETTE[2] },
      { id: "events", name: "Schedule", lexicon: "events", color: PALETTE[3] },
    ],
    items: [
      { id: 1, catId: "tasks", text: "Submit the lab report before Friday", conf: 64, ts: "earlier" },
      { id: 2, catId: "ideas", text: "What if flashcards generated themselves from lecture notes", conf: 71, ts: "earlier" },
      { id: 3, catId: "events", text: "Dentist appointment Tuesday at 4pm", conf: 88, ts: "earlier" },
    ],
  },
  corporate: {
    categories: [
      { id: "brainstorm", name: "Brainstorm", lexicon: "brainstorm", color: PALETTE[4] },
      { id: "actions", name: "Action items", lexicon: "tasks", color: PALETTE[0] },
      { id: "projects", name: "Projects", lexicon: "plans", color: PALETTE[2] },
      { id: "schedule", name: "Scheduling", lexicon: "events", color: PALETTE[3] },
    ],
    items: [
      { id: 4, catId: "brainstorm", text: "Thoughts on renaming the onboarding flow?", conf: 77, ts: "earlier" },
      { id: 5, catId: "schedule", text: "All-hands moved to Thursday 11am", conf: 90, ts: "earlier" },
    ],
  },
};

const EXAMPLES = [
  "team sync tomorrow at 10am",
  "what if onboarding was a game",
  "fix the login redirect bug",
  "quantum sandwich logistics",
];

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ---------- app ----------

export default function App() {
  const [mode, setMode] = useState("personal");
  const [data, setData] = useState(INITIAL);
  const [input, setInput] = useState("");
  const [trace, setTrace] = useState(null);
  const [pending, setPending] = useState(null);
  const [newName, setNewName] = useState("");
  const inputRef = useRef(null);

  const { categories, items } = data[mode];

  const patch = (fn) => setData((d) => ({ ...d, [mode]: fn(d[mode]) }));
  const addItem = (text, catId, conf) =>
    patch((m) => ({ ...m, items: [{ id: Date.now(), catId, text, conf, ts: now() }, ...m.items] }));

  function route() {
    const text = input.trim();
    if (!text) return;
    const res = classify(text, categories);
    setTrace({ text, res });
    if (res.total === 0 || res.confidence < 35) {
      setPending({ text });
      setNewName(suggestName(text));
    } else {
      addItem(text, res.best.cat.id, res.confidence);
      setPending(null);
    }
    setInput("");
    inputRef.current && inputRef.current.focus();
  }

  function createCategory() {
    const name = newName.trim();
    if (!name || !pending) return;
    const cat = { id: "c" + Date.now(), name, words: [name.toLowerCase()], color: PALETTE[categories.length % PALETTE.length] };
    patch((m) => ({ ...m, categories: [...m.categories, cat] }));
    setTimeout(() => addItem(pending.text, cat.id, 100), 0);
    setPending(null);
  }

  function fileUnder(catId) {
    if (!pending || !catId) return;
    addItem(pending.text, catId, 100);
    setPending(null);
  }

  function refile(itemId, catId) {
    patch((m) => ({
      ...m,
      items: m.items.map((it) => (it.id === itemId ? { ...it, catId, refiled: true } : it)),
    }));
  }

  const removeItem = (id) => patch((m) => ({ ...m, items: m.items.filter((it) => it.id !== id) }));

  function switchMode(next) {
    setMode(next);
    setTrace(null);
    setPending(null);
  }

  const maxScore = trace ? Math.max(1, ...trace.res.rows.map((r) => r.score)) : 1;

  return (
    <div className="sift">
      <style>{css}</style>

      <header className="top">
        <div>
          <div className="wordmark">SIFT</div>
          <div className="tag">type anything — it finds its place</div>
        </div>
        <div className="seg" role="tablist" aria-label="Edition">
          {["personal", "corporate"].map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} className={"segbtn" + (mode === m ? " on" : "")} onClick={() => switchMode(m)}>
              {m === "personal" ? "Personal" : "Corporate"}
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
          placeholder={mode === "personal" ? "buy a power strip… what if… dentist friday 3pm…" : "should we rename the API… standup at 9:30… ship by Q3…"}
          aria-label="Capture input"
        />
        <button className="go" onClick={route}>Route it</button>
      </div>

      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => { setInput(ex); inputRef.current && inputRef.current.focus(); }}>
            {ex}
          </button>
        ))}
      </div>

      {trace && (
        <div className="trace" aria-live="polite">
          <div className="tr-head">ROUTING TRACE — "{trace.text}"</div>
          {trace.res.rows.map((r) => (
            <div className="tr-row" key={r.cat.id}>
              <span className="tr-name">{r.cat.name}</span>
              <span className="tr-bar"><span style={{ width: (r.score / maxScore) * 100 + "%", background: r.cat.color }} /></span>
              <span className="tr-score">{r.score.toFixed(1)}</span>
              <span className="tr-match">{r.matched.length ? r.matched.map((m) => `'${m}'`).join(" ") : "·"}</span>
            </div>
          ))}
          <div className="tr-verdict">
            {trace.res.total === 0 || trace.res.confidence < 35
              ? "→ no confident match — asking the user"
              : `→ filed under ${trace.res.best.cat.name} · ${trace.res.confidence}% confident`}
          </div>
        </div>
      )}

      {pending && (
        <div className="suggest">
          <div className="sg-text">Nothing fits <b>"{pending.text}"</b>. Create a new space?</div>
          <div className="sg-row">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New category name" />
            <button className="go" onClick={createCategory}>Create "{newName.trim() || "…"}"</button>
            <select defaultValue="" onChange={(e) => fileUnder(e.target.value)} aria-label="File under existing category">
              <option value="" disabled>…or file under</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="ghost" onClick={() => setPending(null)}>Discard</button>
          </div>
        </div>
      )}

      <div className="board">
        {categories.map((c) => {
          const list = items.filter((it) => it.catId === c.id);
          return (
            <section className="col" key={c.id}>
              <header className="col-head" style={{ borderTopColor: c.color }}>
                <span className="dot" style={{ background: c.color }} />
                <span className="col-name">{c.name}</span>
                <span className="count">{list.length}</span>
              </header>
              {list.length === 0 && <div className="empty">Nothing here yet — type above.</div>}
              {list.map((it) => (
                <article className="card drop-in" key={it.id}>
                  <p>{it.text}</p>
                  <footer>
                    <span className="meta">{it.ts} · {it.conf}%{it.refiled ? " · ✎ refiled" : ""}</span>
                    <span className="actions">
                      <select value={it.catId} onChange={(e) => refile(it.id, e.target.value)} aria-label="Move item">
                        {categories.map((cc) => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
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

      <footer className="foot">mocked classifier · overrides would feed the real model · {mode} edition</footer>
    </div>
  );
}

// ---------- styles ----------

const css = `
.sift { --bg:#ECEFF3; --surface:#fff; --ink:#18222E; --muted:#5B6B7C; --line:#D7DEE6;
  min-height:100vh; background:var(--bg); color:var(--ink); padding:28px clamp(14px,4vw,48px);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.sift *:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
.top { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-bottom:22px; }
.wordmark { font-weight:800; font-size:30px; letter-spacing:.32em; }
.tag { color:var(--muted); font-size:13px; margin-top:2px; }
.seg { display:flex; background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:3px; }
.segbtn { border:0; background:transparent; padding:7px 16px; border-radius:8px; font-weight:600; font-size:13px; color:var(--muted); cursor:pointer; }
.segbtn.on { background:var(--ink); color:#fff; }
.capture { display:flex; gap:10px; }
.capture input { flex:1; font-size:17px; padding:14px 16px; border:2px solid var(--ink); border-radius:12px; background:var(--surface); color:var(--ink); }
.go { border:0; background:var(--ink); color:#fff; font-weight:700; padding:0 22px; border-radius:12px; cursor:pointer; font-size:15px; }
.ghost { border:1px solid var(--line); background:transparent; color:var(--muted); border-radius:10px; padding:8px 14px; cursor:pointer; }
.examples { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0 18px; }
.chip { border:1px dashed var(--line); background:var(--surface); color:var(--muted); border-radius:999px; padding:5px 12px; font-size:12.5px; cursor:pointer; }
.chip:hover { color:var(--ink); border-color:var(--ink); }
.trace { background:var(--ink); color:#E8EDF3; border-radius:12px; padding:14px 16px; margin-bottom:14px;
  font-family: ui-monospace, "Cascadia Mono", Menlo, monospace; font-size:12.5px; }
.tr-head { color:#9FB0C2; letter-spacing:.12em; margin-bottom:10px; }
.tr-row { display:grid; grid-template-columns: 110px 1fr 38px minmax(0,1.2fr); gap:10px; align-items:center; margin:5px 0; }
.tr-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tr-bar { height:8px; background:#2A3848; border-radius:4px; overflow:hidden; }
.tr-bar span { display:block; height:100%; transition:width .45s ease; }
.tr-score { text-align:right; color:#9FB0C2; }
.tr-match { color:#7FD1A8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tr-verdict { margin-top:10px; font-weight:700; }
.suggest { background:var(--surface); border:2px dashed var(--ink); border-radius:12px; padding:14px 16px; margin-bottom:14px; }
.sg-text { margin-bottom:10px; font-size:14.5px; }
.sg-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.sg-row input, .sg-row select { padding:8px 12px; border:1px solid var(--line); border-radius:10px; background:#fff; color:var(--ink); font-size:14px; }
.sg-row .go { padding:9px 16px; }
.board { display:grid; grid-template-columns:repeat(auto-fit, minmax(235px, 1fr)); gap:14px; align-items:start; }
.col { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:12px; }
.col-head { display:flex; align-items:center; gap:8px; padding:2px 4px 10px; border-top:3px solid; margin:-12px -12px 10px; padding:10px 14px; border-radius:14px 14px 0 0; }
.dot { width:9px; height:9px; border-radius:50%; }
.col-name { font-weight:700; font-size:14px; }
.count { margin-left:auto; color:var(--muted); font-size:12px; background:var(--bg); border-radius:999px; padding:2px 9px; }
.empty { color:var(--muted); font-size:12.5px; padding:8px 4px 4px; }
.card { border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin-bottom:8px; background:#fff; }
.card p { margin:0 0 8px; font-size:14px; line-height:1.45; }
.card footer { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.meta { color:var(--muted); font-size:11.5px; }
.actions { display:flex; gap:6px; align-items:center; }
.actions select { font-size:11.5px; border:1px solid var(--line); border-radius:8px; padding:3px 6px; background:#fff; color:var(--muted); }
.x { border:0; background:transparent; color:var(--muted); font-size:16px; cursor:pointer; line-height:1; }
.x:hover { color:#B23A3A; }
.foot { margin-top:22px; color:var(--muted); font-size:12px; text-align:center; }
.drop-in { animation: drop .3s ease; }
@keyframes drop { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .drop-in { animation:none; } .tr-bar span { transition:none; } }
`;

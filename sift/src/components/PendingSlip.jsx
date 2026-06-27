export default function PendingSlip({ pending, setPending, categories, onCreate, onFileUnder, onDiscard }) {
  return (
    <div className="suggest">
      <div className="sg-text">
        Nothing fits <b>"{pending.text}"</b>. New tray?
      </div>
      <div className="sg-row">
        <input
          value={pending.name}
          onChange={(e) => setPending({ ...pending, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onCreate(pending.name)}
          aria-label="New tray name"
        />
        <button className="btn" onClick={() => onCreate(pending.name)}>
          create "{pending.name.trim() || "…"}"
        </button>
        <select value="" onChange={(e) => onFileUnder(e.target.value)} aria-label="File under existing tray">
          <option value="" disabled>…or file under</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="ghost" onClick={onDiscard}>discard</button>
      </div>
    </div>
  );
}

const EXAMPLES = ["dentist friday at 3pm", "what if alarms snoozed themselves", "fix the squeaky door", "quantum sandwich logistics"];

export default function Capture({ input, setInput, onRoute, inputRef }) {
  return (
    <>
      <div className="capture">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onRoute()}
          placeholder="buy a power strip… what if… dentist friday 3pm…"
          aria-label="Capture input"
          enterKeyHint="send"
        />
        <button className="btn go" onClick={onRoute}>route it</button>
      </div>
      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => { setInput(ex); inputRef.current?.focus(); }}>
            {ex}
          </button>
        ))}
      </div>
    </>
  );
}

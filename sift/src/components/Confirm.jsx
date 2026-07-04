// In-app confirm — window.confirm() silently returns false in extension
// sidebars/popups, so destructive actions go through this instead.
export default function Confirm({ text, onYes, onNo }) {
  return (
    <div className="scrim" onClick={onNo}>
      <div className="sheet confirm" role="alertdialog" aria-label="Confirm" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">CONFIRM</div>
        <div className="confirm-text">{text}</div>
        <div className="sheet-acts">
          <span className="spacer" />
          <button className="ghost" onClick={onNo}>cancel</button>
          <button className="btn" autoFocus onClick={onYes}>confirm</button>
        </div>
      </div>
    </div>
  );
}

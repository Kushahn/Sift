export default function Toast({ toast, onUndo }) {
  return (
    <div className="toast" role="status">
      {toast.text}
      {toast.undoId && (
        <button className="btn small" onClick={() => onUndo(toast.undoId)}>undo</button>
      )}
    </div>
  );
}

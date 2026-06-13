import Tray from "./Tray.jsx";

function sortItems(list, sort) {
  if (sort !== "due") return list; // capture order is already newest-first
  return [...list].sort((a, b) => {
    const rank = (it) => (it.due != null ? 0 : it.vague ? 1 : 2);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 0) return a.due - b.due;
    return (b.created || 0) - (a.created || 0);
  });
}

export default function Board({ categories, items, canDelete, onRenameTray, onDeleteTray, onToggleDone, onRefile, onRemove, sort, onEdit }) {
  return (
    <div className="board">
      {categories.map((c) => (
        <Tray
          key={c.id}
          cat={c}
          items={sortItems(items.filter((it) => it.catId === c.id), sort)}
          categories={categories}
          canDelete={canDelete}
          onRename={onRenameTray}
          onDelete={onDeleteTray}
          onToggleDone={onToggleDone}
          onRefile={onRefile}
          onRemove={onRemove}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

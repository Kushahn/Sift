import Tray from "./Tray.jsx";

export default function Board({ categories, items, canDelete, onRenameTray, onDeleteTray, onToggleDone, onRefile, onRemove }) {
  return (
    <div className="board">
      {categories.map((c) => (
        <Tray
          key={c.id}
          cat={c}
          items={items.filter((it) => it.catId === c.id)}
          categories={categories}
          canDelete={canDelete}
          onRename={onRenameTray}
          onDelete={onDeleteTray}
          onToggleDone={onToggleDone}
          onRefile={onRefile}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

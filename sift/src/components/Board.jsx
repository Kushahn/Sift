import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, pointerWithin,
} from "@dnd-kit/core";
import Tray from "./Tray.jsx";
import ItemCard from "./ItemCard.jsx";

function sortItems(list, sort) {
  if (sort !== "due") return list; // capture order is already newest-first
  return [...list].sort((a, b) => {
    const rank = (it) => (it.due != null ? 0 : it.vague ? 1 : 2);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 0) return a.due - b.due;
    return (b.created || 0) - (a.created || 0);
  });
}

export default function Board({ categories, items, sort, canDelete, onRenameTray, onDeleteTray, onToggleCollapse, onToggleDone, onRefile, onRemove, onEdit, theme }) {
  const [dragId, setDragId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function handleDragEnd(e) {
    setDragId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const catId = String(overId).split(":")[1];
    const item = items.find((it) => it.id === e.active.id);
    if (catId && item && item.catId !== catId) onRefile(item.id, catId);
  }

  const dragItem = dragId ? items.find((it) => it.id === dragId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setDragId(e.active.id)}
      onDragCancel={() => setDragId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="board">
        {categories.map((c) => (
          <Tray
            key={c.id}
            cat={c}
            items={sortItems(items.filter((it) => it.catId === c.id), sort)}
            categories={categories}
            theme={theme}
            canDelete={canDelete}
            onRename={onRenameTray}
            onDelete={onDeleteTray}
            onToggleCollapse={onToggleCollapse}
            onToggleDone={onToggleDone}
            onRefile={onRefile}
            onRemove={onRemove}
            onEdit={onEdit}
          />
        ))}
      </div>
      <DragOverlay>
        {dragItem && (
          <div className="dragproof">
            <ItemCard item={dragItem} categories={categories}
              onToggleDone={() => {}} onRefile={() => {}} onRemove={() => {}} onEdit={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

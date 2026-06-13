import { useState, useEffect, useRef } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, pointerWithin, useDroppable,
} from "@dnd-kit/core";
import Tray from "./Tray.jsx";
import ItemCard from "./ItemCard.jsx";
import { inkFor } from "../lib/store.js";

function sortItems(list, sort) {
  if (sort !== "due") return list; // capture order is already newest-first
  return [...list].sort((a, b) => {
    const rank = (it) => (it.due != null ? 0 : it.vague ? 1 : 2);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 0) return a.due - b.due;
    return (b.created || 0) - (a.created || 0);
  });
}

function TrayTab({ cat, count, active, theme, onSelect }) {
  const { isOver, setNodeRef } = useDroppable({ id: "tab:" + cat.id });
  return (
    <button
      ref={setNodeRef}
      className={"traytab" + (active ? " on" : "") + (isOver ? " over" : "")}
      style={{ "--c": inkFor(cat.color, theme) }}
      onClick={onSelect}
    >
      <span className="drum" aria-hidden="true" />
      {cat.name} <span className="tabcount">{count}</span>
    </button>
  );
}

export default function Board({ categories, items, sort, canDelete, onRenameTray, onDeleteTray, onToggleDone, onRefile, onRemove, onEdit, theme }) {
  const [dragId, setDragId] = useState(null);
  const [activeTray, setActiveTray] = useState(categories[0]?.id);
  const boardRef = useRef(null);
  const trayRefs = useRef({});

  useEffect(() => {
    const root = boardRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) if (en.isIntersecting) setActiveTray(en.target.dataset.trayid);
      },
      { root, threshold: 0.6 },
    );
    Object.values(trayRefs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [categories]);

  const scrollToTray = (id) =>
    trayRefs.current[id]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

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
      <div className="traytabs" role="tablist" aria-label="Trays">
        {categories.map((c) => (
          <TrayTab
            key={c.id}
            cat={c}
            count={items.filter((it) => it.catId === c.id).length}
            active={activeTray === c.id}
            theme={theme}
            onSelect={() => scrollToTray(c.id)}
          />
        ))}
      </div>
      <div className="board" ref={boardRef}>
        {categories.map((c) => (
          <div key={c.id} className="traywrap" data-trayid={c.id} ref={(el) => { trayRefs.current[c.id] = el; }}>
            <Tray
              cat={c}
              items={sortItems(items.filter((it) => it.catId === c.id), sort)}
              categories={categories}
              theme={theme}
              canDelete={canDelete}
              onRename={onRenameTray}
              onDelete={onDeleteTray}
              onToggleDone={onToggleDone}
              onRefile={onRefile}
              onRemove={onRemove}
              onEdit={onEdit}
            />
          </div>
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

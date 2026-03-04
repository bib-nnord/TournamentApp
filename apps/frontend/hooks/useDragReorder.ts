"use client";

import { useRef, useState } from "react";

export function useDragReorder<T>(setItems: React.Dispatch<React.SetStateAction<T[]>>) {
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(index);
  }

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) {
      setDragOver(null);
      return;
    }
    setItems((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex.current!, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
    dragIndex.current = null;
    setDragOver(null);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOver(null);
  }

  return { dragOver, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
}

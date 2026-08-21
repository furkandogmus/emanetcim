"use client";

import { useState, useRef, useCallback } from "react";

interface SwipeToDismissOptions {
  onDismiss: () => void;
  threshold?: number;
}

export function useSwipeToDismiss({ onDismiss, threshold = 100 }: SwipeToDismissOptions) {
  const [offset, setOffset] = useState(0);
  // Render'da okunan deger state'te tutuluyor; ref sadece touch handler'lar arasi
  // senkron (ayni tick) kontrol icin — [[react-hooks/refs]]: ref.current render
  // sirasinda okunmamali.
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const draggingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    draggingRef.current = true;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!draggingRef.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setOffset(dy * 0.6);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    if (offset > threshold) {
      onDismiss();
    }
    setOffset(0);
  }, [offset, threshold, onDismiss]);

  return {
    offset,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    style: {
      transform: offset > 0 ? `translateY(${offset}px)` : undefined,
      transition: isDragging ? "none" : "transform 0.3s ease",
    },
  };
}

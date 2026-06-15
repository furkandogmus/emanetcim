"use client";

import { useState, useRef, useCallback } from "react";

interface SwipeToDismissOptions {
  onDismiss: () => void;
  threshold?: number;
}

export function useSwipeToDismiss({ onDismiss, threshold = 100 }: SwipeToDismissOptions) {
  const [offset, setOffset] = useState(0);
  const startY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setOffset(dy * 0.6);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
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
      transition: isDragging.current ? "none" : "transform 0.3s ease",
    },
  };
}

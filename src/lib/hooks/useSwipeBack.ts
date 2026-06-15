"use client";

import { useEffect, useRef, useCallback } from "react";

interface SwipeBackOptions {
  onSwipeBack: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useSwipeBack({ onSwipeBack, threshold = 80, enabled = true }: SwipeBackOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isSwiping.current = true;
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isSwiping.current || !enabled) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 30 && Math.abs(dx) < 20) {
      isSwiping.current = false;
    }
  }, [enabled]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isSwiping.current || !enabled) return;
    isSwiping.current = false;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx > threshold && startX.current < 40) {
      onSwipeBack();
    }
  }, [enabled, threshold, onSwipeBack]);

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  containerRef: React.RefObject<HTMLElement | null>;
  threshold?: number;
  enabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  containerRef,
  threshold = 80,
  enabled = true,
}: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || !containerRef.current) return;
    if (containerRef.current.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [enabled, containerRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || !enabled) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      const damped = dy * 0.5;
      setPullDistance(Math.min(damped, threshold * 1.5));
    }
  }, [enabled, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || !enabled) return;
    pulling.current = false;
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [enabled, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pullDistance, isRefreshing };
}

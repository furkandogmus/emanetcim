"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Snap points in vh (0-100). Default: [25, 60, 90] */
  snapPoints?: number[];
  /** Initial snap index. Default: 1 */
  initialSnap?: number;
  /** Show drag handle */
  showHandle?: boolean;
  /** Show close button */
  showClose?: boolean;
  /** Show overlay backdrop. Set false for map+list split view */
  showOverlay?: boolean;
}

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  snapPoints = [25, 60, 90],
  initialSnap = 1,
  showHandle = true,
  showClose = true,
  showOverlay = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  // "open" prop degistiginde snap'i sifirlama — React'in onerdigi "render sirasinda
  // state ayarlama" deseni (bir effect'te setState yerine): [[react-hooks/set-state-in-effect]]
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setCurrentSnap(initialSnap);
    }
  }
  const dragStartY = useRef(0);
  const dragStartSnap = useRef(initialSnap);
  const isDragging = useRef(false);

  const snapTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, snapPoints.length - 1));
    setCurrentSnap(clamped);
  }, [snapPoints]);

  const handleDragStart = useCallback((clientY: number) => {
    dragStartY.current = clientY;
    dragStartSnap.current = currentSnap;
    isDragging.current = true;
  }, [currentSnap]);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging.current || !sheetRef.current) return;
    const diff = dragStartY.current - clientY;
    const vhDiff = (diff / window.innerHeight) * 100;
    const currentHeight = snapPoints[dragStartSnap.current];
    const newHeight = currentHeight + vhDiff;
    const clamped = Math.max(snapPoints[0], Math.min(newHeight, snapPoints[snapPoints.length - 1]));
    sheetRef.current.style.setProperty("--sheet-height", `${clamped}vh`);
  }, [snapPoints]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!sheetRef.current) return;

    const current = parseFloat(sheetRef.current.style.getPropertyValue("--sheet-height") || `${snapPoints[currentSnap]}vh`);
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < snapPoints.length; i++) {
      const diff = Math.abs(current - snapPoints[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    }
    if (closest === 0 && currentSnap <= 0) {
      onClose();
      return;
    }
    snapTo(closest);
    sheetRef.current.style.removeProperty("--sheet-height");
  }, [snapPoints, currentSnap, onClose, snapTo]);

  useEffect(() => {
    if (!open) return;
    const handleTouchMove = (e: TouchEvent) => {
      handleDragMove(e.touches[0].clientY);
    };
    const handleTouchEnd = () => {
      handleDragEnd();
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [open, handleDragMove, handleDragEnd]);

  const sheetHeight = snapPoints[currentSnap];

  return (
    <div
      className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
    >
      {showOverlay && (
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 z-10 bg-white flex flex-col transition-transform duration-300 ${showOverlay ? "rounded-t-[2rem] shadow-2xl" : "rounded-t-[1.5rem] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"}`}
        style={{
          height: `var(--sheet-height, ${sheetHeight}vh)`,
          transform: open ? "translateY(0)" : "translateY(100%)",
        }}
      >
        {showHandle && (
          <div
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
            onMouseDown={(e) => handleDragStart(e.clientY)}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          >
            <div className="w-12 h-1.5 rounded-full bg-gray-300" />
          </div>
        )}

        {(title || showClose) && (
          <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-50 shrink-0">
            {title ? (
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">{title}</h2>
            ) : (
              <div />
            )}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                aria-label="Close"
              >
                <X size={16} className="text-gray-600" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}

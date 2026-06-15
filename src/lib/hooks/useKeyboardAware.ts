"use client";

import { useState, useEffect } from "react";

export function useKeyboardAware() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("visualViewport" in window)) return;

    const handleResize = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const windowHeight = window.innerHeight;
      const diff = windowHeight - viewport.height;
      setKeyboardHeight(Math.max(0, diff));
    };

    window.visualViewport!.addEventListener("resize", handleResize);
    window.visualViewport!.addEventListener("scroll", handleResize);
    return () => {
      window.visualViewport!.removeEventListener("resize", handleResize);
      window.visualViewport!.removeEventListener("scroll", handleResize);
    };
  }, []);

  return { keyboardHeight };
}

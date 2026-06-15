"use client";

import { useCallback } from "react";
import { toast } from "sonner";

interface ShareOptions {
  title: string;
  text: string;
  url: string;
}

export function useShare() {
  const share = useCallback(async ({ title, text, url }: ShareOptions) => {
    const shareData = { title, text, url };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return false;
        fallbackCopy(url);
        return true;
      }
    } else {
      fallbackCopy(url);
      return true;
    }
  }, []);

  return { share };
}

function fallbackCopy(text: string) {
  if (typeof navigator === "undefined") return;
  navigator.clipboard?.writeText(text).then(() => {
    toast.success("Link copied to clipboard");
  }).catch(() => {
    toast.error("Could not copy link");
  });
}

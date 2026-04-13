"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/browser";

/**
 * Tarayıcı hataları için Sentry. `NEXT_PUBLIC_SENTRY_DSN` tanımlıysa yüklenir.
 */
export default function SentryClientInit() {
  useEffect(() => {
    const g = globalThis as unknown as { __bagajpark_sentry_client__?: boolean };
    if (g.__bagajpark_sentry_client__) return;
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
    if (!dsn) return;
    g.__bagajpark_sentry_client__ = true;
    const raw = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE?.trim();
    const parsed = raw ? Number(raw) : 0.05;
    const sample =
      Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.05;
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: sample,
    });
  }, []);
  return null;
}

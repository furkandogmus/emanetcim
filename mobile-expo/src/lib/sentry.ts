import type { ComponentType } from "react";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import * as Sentry from "@sentry/react-native";

import { scrubBreadcrumb, scrubEvent } from "./sentry-scrub";

/**
 * Cokme raporu. DSN yoksa (yerel, test, DSN tanimlanmamis derleme) hicbir sey kurulmaz ve
 * hicbir sey gonderilmez. DSN gizli degil; derleme ortamindan `EXPO_PUBLIC_SENTRY_DSN` ile ya
 * da `extra.sentryDsn` ile gelir.
 */
const DSN: string =
  process.env.EXPO_PUBLIC_SENTRY_DSN || ((Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ?? "");

export const sentryEnabled = DSN.length > 0;

export function initSentry() {
  if (!sentryEnabled) return;
  const version = Constants.expoConfig?.version ?? "0.0.0";
  // OTA cokmesi dogru kaynak haritasina dussun: surum ikili, dist guncelleme kimligi.
  const updateId = Updates.updateId ?? "embedded";
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    release: `com.bagajpark@${version}`,
    dist: updateId,
    environment: __DEV__ ? "development" : Updates.channel || "production",
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    maxBreadcrumbs: 50,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
  Sentry.setTags({
    "expo-update-id": updateId,
    "expo-runtime-version": Updates.runtimeVersion ?? version,
    "expo-channel": Updates.channel || "none",
    "expo-embedded": String(Updates.isEmbeddedLaunch),
  });
}

/** Yalniz opak kullanici kimligi ve rol; e-posta/telefon asla. */
export function setSentryUser(id: string | null, role: string | null) {
  if (!sentryEnabled) return;
  Sentry.setUser(id ? { id } : null);
  Sentry.setTag("role", role ?? "anon");
}

export function captureError(err: unknown) {
  if (sentryEnabled) Sentry.captureException(err);
}

export function wrapRoot<P extends Record<string, unknown>>(C: ComponentType<P>): ComponentType<P> {
  return sentryEnabled ? Sentry.wrap(C) : C;
}

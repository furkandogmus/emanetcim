import "@/lib/auth-public-url";
import { requireProdSecrets } from "@/lib/env";
import logger from "@/lib/logger";
import type { InstrumentationOnRequestError } from "next/dist/server/instrumentation/types";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    requireProdSecrets();
    if (process.env.SENTRY_DSN?.trim()) {
      const Sentry = await import("@sentry/node");
      const release =
        process.env.APP_VERSION?.trim() ||
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
        process.env.npm_package_version;
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.05,
        ...(release ? { release } : {}),
        serverName: process.env.OBSERVABILITY_SERVICE_NAME || "bagajpark",
      });
    }
  }
}

export const onRequestError: InstrumentationOnRequestError = (
  error,
  errorRequest,
  errorContext,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const rid = errorRequest.headers["x-request-id"];
  const requestId = Array.isArray(rid) ? rid[0] : rid;

  logger.error(
    {
      err: error,
      path: errorRequest.path,
      method: errorRequest.method,
      requestId,
      routePath: errorContext.routePath,
      routeType: errorContext.routeType,
      routerKind: errorContext.routerKind,
    },
    "request_error",
  );

  if (process.env.SENTRY_DSN?.trim()) {
    void import("@sentry/node").then((Sentry) => {
      Sentry.captureException(error);
    });
  }
};

import "@/lib/auth-public-url";
import { requireProdSecrets } from "@/lib/env";
import logger from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import type { InstrumentationOnRequestError } from "next/dist/server/instrumentation/types";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    requireProdSecrets();
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: InstrumentationOnRequestError = (
  error,
  errorRequest,
  errorContext,
) => {
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

  Sentry.captureException(error, {
    tags: {
      path: errorRequest.path,
      method: errorRequest.method,
      routePath: errorContext.routePath,
      routeType: errorContext.routeType,
      routerKind: errorContext.routerKind,
    },
  });
};
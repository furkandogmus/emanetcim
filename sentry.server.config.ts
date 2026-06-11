import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.05,

  sendDefaultPii: true,

  includeLocalVariables: true,

  environment: process.env.NODE_ENV,

  release:
    process.env.APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),

  serverName: process.env.OBSERVABILITY_SERVICE_NAME || "bagajpark",

  enableLogs: true,
});
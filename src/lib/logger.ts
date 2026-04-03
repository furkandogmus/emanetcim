import pino from 'pino';

const version =
  process.env.APP_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
  process.env.npm_package_version ||
  'dev';

/**
 * Yapılandırılmış log (Pino). Üretimde JSON; geliştirmede pino-pretty.
 * Log toplayıcıya (Loki, CloudWatch, Datadog agent) uygun alanlar: service, env, version.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: {
    env: process.env.NODE_ENV,
    service: 'emanetci',
    version,
  },
  redact: [
    'password',
    '*.password',
    'authorization',
    '*.authorization',
    'cookie',
    '*.cookie',
    'user.password',
    'card.cardNumber',
    'card.cvc',
    'DATABASE_URL',
    'AUTH_SECRET',
  ],
});

export default logger;

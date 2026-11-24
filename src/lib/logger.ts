import pino from 'pino';
import { SERVER_VERSION } from './server-version';

const version = SERVER_VERSION;

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
    service: process.env.OBSERVABILITY_SERVICE_NAME || 'bagajpark',
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

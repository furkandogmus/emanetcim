import logger from "@/lib/logger";

/**
 * Yapılandırılmış log üzerinden metrik olayı (Prometheus/Datadog tarafında parse edilebilir).
 * Bkz. docs/GUVENLIK_VE_IZLEME.md
 */
export function recordMetric(
  name: string,
  fields?: Record<string, unknown>,
): void {
  logger.info(
    { metric: name, service: "emanetci", ...fields },
    name,
  );
}

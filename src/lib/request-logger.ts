import { headers } from "next/headers";
import logger from "@/lib/logger";

/**
 * Route handler / Server Action içinde çağırın; `proxy` katmanı `x-request-id` üretir veya iletir.
 */
export async function getRequestLogger() {
  const h = await headers();
  const requestId = h.get("x-request-id");
  return requestId ? logger.child({ requestId }) : logger;
}

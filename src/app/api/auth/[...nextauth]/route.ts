import { handlers } from "@/auth";
import { NextRequest } from "next/server";

/**
 * Ters vekil (nginx/ngrok) arkasında Next.js standalone bind adresi (0.0.0.0:3000)
 * request URL'ine sızar. X-Forwarded-Host / Proto ile doğru URL'i yeniden üretir.
 */
function withForwardedUrl(req: NextRequest): NextRequest {
  const fwdHost = req.headers.get("x-forwarded-host");
  if (!fwdHost) return req;

  const fwdProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const url = req.nextUrl.clone();
  url.protocol = fwdProto;
  url.host = fwdHost;
  url.port = "";

  return new NextRequest(url, {
    method: req.method,
    headers: req.headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    duplex: req.method !== "GET" && req.method !== "HEAD" ? "half" as const : undefined,
  });
}

export async function GET(req: NextRequest) {
  return handlers.GET(withForwardedUrl(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withForwardedUrl(req));
}

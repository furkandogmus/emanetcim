import { handlers } from "@/auth";
import { NextRequest } from "next/server";

/**
 * Ters vekil / ngrok arkasında Next.js’in gördüğü URL iç bind (127.0.0.1:3000) kalmasın;
 * OAuth redirect_uri ve callback ile Google Console’daki URI birebir eşleşsin.
 *
 * Ngrok bazen yalnızca `Host` gönderir; `X-Forwarded-Host` yoksa `Host` kullanılır.
 */
function pickForwardedHost(req: NextRequest): string | null {
  const xfh = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (xfh) return xfh;
  return req.headers.get("host")?.split(",")[0]?.trim() || null;
}

function pickForwardedProto(req: NextRequest, host: string): "http" | "https" {
  const raw = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (raw === "http" || raw === "https") return raw;
  const h = host.toLowerCase();
  if (h.includes("ngrok")) return "https";
  if (h.startsWith("localhost") || h.startsWith("127.") || h.startsWith("[::1]"))
    return "http";
  return "https";
}

function withForwardedUrl(req: NextRequest): NextRequest {
  const host = pickForwardedHost(req);
  if (!host) return req;

  const proto = pickForwardedProto(req, host);
  let origin: string;
  try {
    origin = new URL(`${proto}://${host}`).origin;
  } catch {
    return req;
  }

  const path = req.nextUrl.pathname + req.nextUrl.search;
  const url = new URL(path, origin);

  return new NextRequest(url, {
    method: req.method,
    headers: req.headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    duplex: req.method !== "GET" && req.method !== "HEAD" ? ("half" as const) : undefined,
  });
}

export async function GET(req: NextRequest) {
  return handlers.GET(withForwardedUrl(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withForwardedUrl(req));
}

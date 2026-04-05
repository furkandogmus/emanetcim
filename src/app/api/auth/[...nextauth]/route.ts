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

// #region agent log
function _debugLog(tag: string, original: NextRequest, rewritten: NextRequest) {
  const data = {
    tag,
    originalUrl: original.url,
    rewrittenUrl: rewritten.url,
    host: original.headers.get("host"),
    xfh: original.headers.get("x-forwarded-host"),
    xfp: original.headers.get("x-forwarded-proto"),
  };
  fetch('http://127.0.0.1:7437/ingest/a146a2a5-53c0-41d3-8e80-a809c894f9e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'78498b'},body:JSON.stringify({sessionId:'78498b',location:'route.ts:auth-handler',message:'auth-route-request',data,timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
}
// #endregion

export async function GET(req: NextRequest) {
  const rewritten = withForwardedUrl(req);
  // #region agent log
  _debugLog("GET", req, rewritten);
  // #endregion
  return handlers.GET(rewritten);
}

export async function POST(req: NextRequest) {
  const rewritten = withForwardedUrl(req);
  // #region agent log
  _debugLog("POST", req, rewritten);
  // #endregion
  return handlers.POST(rewritten);
}

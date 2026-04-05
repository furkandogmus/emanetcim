import { handlers } from "@/auth";

// #region agent log
const _origGET = handlers.GET;
const _origPOST = handlers.POST;
function _debugLog(tag: string, req: Request) {
  const u = new URL(req.url);
  const data = {
    tag,
    reqUrl: req.url,
    origin: u.origin,
    host: req.headers.get("host"),
    xfh: req.headers.get("x-forwarded-host"),
    xfp: req.headers.get("x-forwarded-proto"),
  };
  fetch('http://127.0.0.1:7437/ingest/a146a2a5-53c0-41d3-8e80-a809c894f9e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'78498b'},body:JSON.stringify({sessionId:'78498b',location:'route.ts:auth-handler',message:'auth-route-request',data,timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
}
export const GET = (req: Request) => { _debugLog("GET", req); return _origGET(req as never); };
export const POST = (req: Request) => { _debugLog("POST", req); return _origPOST(req as never); };
// #endregion

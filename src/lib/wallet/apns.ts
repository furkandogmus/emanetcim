import http2 from "node:http2";
import type { AppleWalletConfig } from "@/lib/wallet/config";

const APNS_HOST = "https://api.push.apple.com";
const APNS_TIMEOUT_MS = 10_000;

export type ApnsResult = { token: string; status: number };

/**
 * Wallet guncelleme push'u: bos govde, konu = pass type id. Kimlik dogrulama
 * Pass Type ID sertifikasinin kendisiyle (TLS istemci sertifikasi); Expo push
 * yolu (`expo-push.ts`) bu bildirimi tasiyamaz. 410 donen token cihazdan silinmistir.
 */
export async function sendPassUpdatePushes(cfg: AppleWalletConfig, tokens: string[]): Promise<ApnsResult[]> {
  if (tokens.length === 0) return [];
  const session = http2.connect(APNS_HOST, {
    cert: cfg.signerCert,
    key: cfg.signerKey,
    ...(cfg.signerKeyPassphrase ? { passphrase: cfg.signerKeyPassphrase } : {}),
  });
  session.on("error", () => undefined);
  try {
    return await Promise.all(tokens.map((token) => pushOne(session, cfg.passTypeId, token)));
  } finally {
    session.close();
  }
}

function pushOne(session: http2.ClientHttp2Session, topic: string, token: string): Promise<ApnsResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (status: number) => {
      if (settled) return;
      settled = true;
      resolve({ token, status });
    };
    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${encodeURIComponent(token)}`,
      "apns-topic": topic,
      "content-type": "application/json",
    });
    req.setTimeout(APNS_TIMEOUT_MS, () => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      done(0);
    });
    req.on("response", (headers) => done(Number(headers[":status"] ?? 0)));
    req.on("error", () => done(0));
    req.resume();
    req.end("{}");
  });
}

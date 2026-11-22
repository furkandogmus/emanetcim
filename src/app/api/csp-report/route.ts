import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import logger from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";

/**
 * `Content-Security-Policy-Report-Only` ihlal raporlarını toplar (next.config.ts).
 * Amaç nonce'lu zorunlu CSP'ye geçmeden önce neyin kırılacağını ölçmek.
 *
 * Uç kimliksiz ve herkese açık, bu yüzden: IP başına hız sınırı, gövde üst
 * sınırı, istek başına en fazla `MAX_REPORTS` rapor. Log'a YALNIZCA direktif ve
 * engellenen adresin HOST'u yazılır: belge adresi ve `script-sample` rezervasyon
 * kodu / token / kullanıcı metni taşıyabilir.
 *
 * Hacim: Trusted Types direktifi çok rapor üretir; her `LOG_SAMPLE` ihlalden
 * biri `info` olarak, o ana kadarki sayaçla loglanır. Report-Only devreye
 * girdikten ~7 gün sonra (2026-11-30 civarı) loglar gözden geçirilip ya nonce'lu
 * zorunlu politikaya geçilmeli ya da bu uç ve başlık kaldırılmalı.
 */

const MAX_BODY_BYTES = 16 * 1024;
const MAX_REPORTS = 10;
const MAX_FIELD = 128;
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
const LOG_SAMPLE = 20;

/** Süreç başına görülen ihlal sayısı; örneklemeyle loglanan kayda eklenir. */
let seen = 0;

const ACCEPTED_TYPES = ["application/csp-report", "application/reports+json", "application/json"];

type Violation = { directive: string; blocked: string; disposition: string };

function truncate(v: unknown): string {
  return typeof v === "string" ? v.slice(0, MAX_FIELD) : "";
}

/** `https://x.example/a?b` -> `x.example`; `inline`/`eval`/`trusted-types-sink` aynen kalır. */
function blockedHost(raw: unknown): string {
  const v = truncate(raw);
  if (!v) return "";
  try {
    const u = new URL(v);
    return u.host || u.protocol.replace(":", "");
  } catch {
    // Anahtar kelime ('inline', 'eval'...) ya da bozuk değer: yalnızca harf/tire kalır.
    return v.replace(/[^a-z-]/gi, "").slice(0, 32);
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** İki biçim: eski `report-uri` (`{"csp-report":{...}}`) ve Reporting API (`[{type, body}]`). */
function parseViolations(body: unknown): Violation[] {
  const legacy = asRecord(asRecord(body)?.["csp-report"]);
  if (legacy) {
    return [
      {
        directive: truncate(legacy["effective-directive"] ?? legacy["violated-directive"]),
        blocked: blockedHost(legacy["blocked-uri"]),
        disposition: truncate(legacy["disposition"]),
      },
    ];
  }
  if (!Array.isArray(body)) return [];
  const out: Violation[] = [];
  for (const item of body.slice(0, MAX_REPORTS)) {
    const r = asRecord(item);
    if (r?.type !== "csp-violation") continue;
    const b = asRecord(r.body);
    if (!b) continue;
    out.push({
      directive: truncate(b.effectiveDirective),
      blocked: blockedHost(b.blockedURL),
      disposition: truncate(b.disposition),
    });
  }
  return out;
}

/** Gövdeyi en fazla `max` bayt okur; aşarsa `null` (Content-Length yalan söyleyebilir). */
async function readCapped(req: NextRequest, max: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function POST(req: NextRequest) {
  const ip = await getClientIp(req);
  if (!(await rateLimit(`csp_report:${ip}`, RATE_MAX, RATE_WINDOW_MS))) {
    return new NextResponse(null, { status: 429 });
  }

  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ACCEPTED_TYPES.includes(type)) {
    return new NextResponse(null, { status: 415 });
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }
  const raw = await readCapped(req, MAX_BODY_BYTES);
  if (raw === null) {
    return new NextResponse(null, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const violations = parseViolations(body);
  if (violations.length === 0) {
    return new NextResponse(null, { status: 400 });
  }
  for (const v of violations) {
    seen += 1;
    if (seen % LOG_SAMPLE === 1) {
      logger.info({ csp: v, format: type, seen, sample: LOG_SAMPLE }, "csp_report_only_violation");
    }
  }
  return new NextResponse(null, { status: 204 });
}

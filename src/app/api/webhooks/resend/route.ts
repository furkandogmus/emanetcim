import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/db";
import type { Resend } from "resend";
import { Resend as ResendCtor } from "resend";
import { normalizeInboundSubjectLine } from "@/lib/reply-subject";

export const dynamic = "force-dynamic";
/** Inbound gövde için art arda bekleme + birkaç deneme (self-hosted / Vercel Pro uyumu). */
export const maxDuration = 60;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Webhook yalnızca metadata verir; gövde için receiving.get gerekir.
 * Resend bazen 404 / geçici hata döner — birkaç deneme (artarak bekleme).
 */
async function fetchInboundBodyWithRetry(
  resend: Resend,
  emailId: string,
): Promise<{ text: string; html: string; lastError: string }> {
  const waitBeforeAttemptMs = [2000, 5000, 10000, 20000];
  let lastError = "";

  for (let i = 0; i < waitBeforeAttemptMs.length; i++) {
    await sleep(waitBeforeAttemptMs[i]);
    try {
      const fullEmail = await resend.emails.receiving.get(emailId);
      const d = fullEmail?.data as
        | { text?: string; html?: string; body?: string }
        | undefined;

      if (d) {
        const t = (d.text ?? d.body ?? "").trim();
        const h = (d.html ?? "").trim();
        if (t || h) {
          return { text: t, html: h, lastError: "" };
        }
      }
      if (fullEmail?.error) {
        lastError = JSON.stringify(fullEmail.error);
      } else {
        lastError = "empty_data";
      }
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error("[Resend receiving.get]", { attempt: i + 1, emailId, err: e });
    }
  }

  return { text: "", html: "", lastError };
}

/** Konu bazen yalnızca data.subject değil headers / üst gövdede gelir (yanıtlar, Exchange). */
function extractInboundSubject(
  body: Record<string, unknown>,
  data: Record<string, unknown>,
): string {
  const direct = data.subject ?? body.subject;
  if (typeof direct === "string" && direct.trim()) {
    return normalizeInboundSubjectLine(direct);
  }
  const headers = data.headers ?? body.headers;
  if (headers && typeof headers === "object") {
    const h = headers as Record<string, unknown>;
    const sub = h.Subject ?? h.subject;
    if (typeof sub === "string" && sub.trim()) {
      return normalizeInboundSubjectLine(sub);
    }
  }
  return "";
}

/** Build / env anahtarı yokken modül yüklemesinde patlamamak için gecikmeli oluşturulur. */
function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new ResendCtor(key);
}

function extractWebhookSignature(req: Request): { svixId: string; svixTs: string; signature: string } | null {
  const svixId = req.headers.get("svix-id")?.trim();
  const svixTs = req.headers.get("svix-timestamp")?.trim();
  const sig = req.headers.get("svix-signature")?.trim();

  if (svixId && svixTs && sig) {
    return { svixId, svixTs, signature: sig };
  }

  // Fallback: legacy header formats
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return { svixId: "", svixTs: "", signature: auth.slice(7).trim() };
  }
  const legacySig =
    req.headers.get("x-resend-signature")?.trim() ||
    req.headers.get("x-webhook-signature")?.trim();
  if (legacySig) return { svixId: "", svixTs: "", signature: legacySig };

  return null;
}

function verifySvixSignature(rawBody: string, svixId: string, svixTs: string, signature: string, secret: string): boolean {
  // Strip whsec_ prefix and decode base64 key
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(rawSecret, "base64");
  } catch {
    secretBytes = Buffer.from(rawSecret);
  }

  // Svix format: signed_content = "${svix_id}.${svix_timestamp}.${body}"
  const signedContent = `${svixId}.${svixTs}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest();
  const expectedHex = expected.toString("hex");

  // Signature comes as "v1,<base64_encoded_hmac>"
  const parts = signature.split(",");
  const provided = parts.length === 2 ? parts[1] : signature;

  let providedBytes: Buffer;
  try {
    providedBytes = Buffer.from(provided, "base64");
  } catch {
    providedBytes = Buffer.from(provided);
  }

  // Compare signatures
  const expectedHexFromProvided = providedBytes.toString("hex");
  const a = Buffer.from(expectedHex);
  const b = Buffer.from(expectedHexFromProvided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Legacy verification for non-Svix secrets
function verifyLegacySignature(rawBody: string, signature: string, secret: string): boolean {
  const provided = signature.replace(/^sha256=/i, "").trim();
  if (!provided) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return NextResponse.json(
        { error: "Webhook misconfigured: RESEND_WEBHOOK_SECRET is required." },
        { status: 503 },
      );
    }
    const rawBody = await req.text();
    const sigData = extractWebhookSignature(req);
    if (!sigData) {
      return NextResponse.json({ error: "Unauthorized: missing signature" }, { status: 401 });
    }

    // Try Svix verification first, then legacy
    const isValid = sigData.svixId
      ? verifySvixSignature(rawBody, sigData.svixId, sigData.svixTs, sigData.signature, secret)
      : verifyLegacySignature(rawBody, sigData.signature, secret);

    if (!isValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    /**
     * Resend Hibrit Webhook İşleme (Flat vs Nested)
     * Bazı eventler { type, data: { ... } } formatında, Inbound olanlar ise düz { from, subject, text } formatında gelir.
     */
    const isNested = !!body.data && typeof body.data === "object";
    const data = (isNested ? body.data : body) as Record<string, unknown>;
    
    // Inbound e-postalarda type olmayabilir, bu yüzden sadece body.type kontrolü yapmak riskli.
    if (isNested && body.type && body.type !== "email.received") {
      return NextResponse.json({ message: "Ignored event type: " + body.type }, { status: 200 });
    }

    const { from, to, email_id } = data;
    const subject = extractInboundSubject(
      body as Record<string, unknown>,
      data as Record<string, unknown>,
    );

    // Başlangıç değerleri (webhook içinden gelenler)
    const content =
      data.content && typeof data.content === "object"
        ? (data.content as Record<string, unknown>)
        : undefined;
    let text = data.text ?? content?.text ?? data.body ?? data.snippet ?? "";
    let html = data.html ?? content?.html ?? "";

    /**
     * EĞER İÇERİK BOŞ VE email_id VARSA:
     * Resend'den tam e-posta içeriğini API yoluyla çekelim.
     * (E-posta bildirimlerinde içerik doğrudan payload'da olmayabilir.)
     */
    let fetchAttempted = false;
    let fetchErrorMsg = "";

    if ((!text && !html) && email_id) {
      fetchAttempted = true;
      const resend = getResendClient();
      if (!resend) {
        fetchErrorMsg = "RESEND_API_KEY not configured; cannot fetch email by id";
      } else {
        const fetched = await fetchInboundBodyWithRetry(resend, email_id as string);
        text = fetched.text;
        html = fetched.html;
        fetchErrorMsg = fetched.lastError;
      }
    }

    // Gövde yoksa: admin panelinde okunaklı özet (tam ham JSON yerine)
    if (!text && !html) {
      const fromStr = typeof from === "string" ? from : "unknown";
      const toStr = Array.isArray(to) ? to.join(", ") : String(to ?? "unknown");
      const msgId =
        typeof (data as { message_id?: string }).message_id === "string"
          ? (data as { message_id: string }).message_id
          : "";

      if (fetchAttempted) {
        text = [
          "İleti gövdesi Resend API üzerinden (receiving) alınamadı; birkaç kez yeniden denendi.",
          "Yanıtlar için gövde genelde API’de metadata’dan sonra hazır olur — yine de 404 alınıyorsa Resend panelinden veya destekten doğrulayın.",
          "",
          `Kimden: ${fromStr}`,
          `Kime: ${toStr}`,
          subject ? `Konu: ${subject}` : "",
          msgId ? `Message-ID: ${msgId}` : "",
          typeof email_id === "string" ? `email_id: ${email_id}` : "",
          "",
          fetchErrorMsg ? `Son API yanıtı: ${fetchErrorMsg}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      } else {
        text = [
          "İçerik yok (email_id gelmedi); yalnızca webhook özeti:",
          "",
          `Kimden: ${fromStr}`,
          `Kime: ${toStr}`,
          subject ? `Konu: ${subject}` : "",
          JSON.stringify(body, null, 2),
        ]
          .filter(Boolean)
          .join("\n");
      }
    }

    // Resend gönderilen adresleri array olarak veriyor olabilir
    const toAddress = Array.isArray(to) ? to.join(", ") : (to || "unknown");

    await prisma.contactMessage.create({
      data: {
        from: (from as string) || "unknown",
        to: toAddress as string,
        subject: subject || "No Subject",
        text: typeof text === "string" ? text : JSON.stringify(text),
        html: typeof html === "string" ? html : JSON.stringify(html),
        raw: (body as object) || {}, // Tam payload'u her zaman saklıyoruz
        isRead: false,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    console.error("[Resend Webhook Error]", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
  }
}

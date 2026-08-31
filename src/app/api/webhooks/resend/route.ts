import { NextResponse } from "next/server";
import {
  verifyWebhook,
  type WebhookSignatureHeaders,
} from "@/lib/webhook-signature";
import prisma from "@/lib/db";
import type { Resend } from "resend";
import { Resend as ResendCtor } from "resend";
import { normalizeInboundSubjectLine } from "@/lib/reply-subject";
import { classifyInboxMessage } from "@/lib/inbox-classifier";
import logger from "@/lib/logger";

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

function extractWebhookSignature(req: Request): WebhookSignatureHeaders | null {
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

    /*
      Doğrulama `src/lib/webhook-signature.ts`'te ve TEST EDİLİYOR. Buradaki
      sürümde `svix-timestamp` imzalanan içeriğe giriyor ama tazeliği hiç
      kontrol edilmiyordu: yakalanan geçerli bir istek sonsuza kadar tekrar
      oynatılabilirdi ve gelen e-posta yolu tekilleştirme yapmadan
      `contactMessage.create` çağırıyor.
    */
    const verdict = verifyWebhook(rawBody, sigData, secret, Date.now());
    if (!verdict.ok) {
      logger.warn({ reason: verdict.reason }, "resend_webhook_rejected");
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

    // Handle email delivery tracking events (sent, delivered, bounced, complained)
    if (isNested && body.type && typeof body.type === "string") {
      const eventType = body.type as string;
      if (["email.sent", "email.delivered", "email.bounced", "email.complained"].includes(eventType)) {
        const emailId = data.email_id as string | undefined;
        const emailTo = (data.to as string[])?.[0] || (data.to as string) || undefined;

        /*
          TEK SATIR GUNCELLENIR (2026-08-31'de duzeltildi).

          Onceki hali `updateMany({ where: { recipient } })` idi: bir e-posta
          icin gelen tek bir olay, O ADRESE gonderilmis BUTUN bildirimlerin
          durumunu birden yaziyordu. Iki sonucu vardi:

            - **Defter anlamsizlasiyordu.** Kirkinci e-postanin "delivered"
              olayi onceki otuz dokuzu da DELIVERED yapiyor, sonraki bir
              "bounced" hepsini BOUNCED yapiyordu. Yani hicbir satirin durumu
              kendi e-postasini anlatmiyordu.
            - **Yazma maliyeti gecmisle buyuyordu.** Cok e-posta almis bir
              adres icin her webhook olayi yuzlerce satir guncelliyordu ve
              webhook her e-posta icin geliyor.

          Ayrica `emailTo` tanimsizken `recipient: ""` araniyordu -- sessiz bir
          eslesmeme.

          DOGRUSU saglayicinin `email_id`'sini satirda saklamak ve onunla
          eslestirmek; `NotificationLog`ta oyle bir sutun YOK, eklemek migration
          istiyor (docs/DEFECT_BACKLOG.md'de kayitli). O gelene kadar o adresin
          EN YENI satiri guncelleniyor: Resend olaylari e-posta basina sirali
          geldigi icin ilgili satir ezici cogunlukla odur, ve yanlis olsa bile
          etkisi bir satirla sinirli kaliyor.
        */
        if (emailId && emailTo) {
          const newStatus = eventType === "email.sent" ? "SENT"
            : eventType === "email.delivered" ? "DELIVERED"
            : eventType === "email.bounced" ? "BOUNCED"
            : "COMPLAINED";

          const latest = await prisma.notificationLog.findFirst({
            where: { recipient: emailTo },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          if (latest) {
            await prisma.notificationLog.update({
              where: { id: latest.id },
              data: { status: newStatus },
            });
          }

          if (eventType === "email.bounced" || eventType === "email.complained") {
            logger.warn({ eventType, emailId }, "resend_delivery_problem");
          }
        }

        return NextResponse.json({ message: `Event ${eventType} processed` }, { status: 200 });
      }

      // Inbound events or unknown: continue processing below
      if (body.type !== "email.received") {
        return NextResponse.json({ message: "Ignored event type: " + body.type }, { status: 200 });
      }
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

    /**
     * Giriş anında sınıflandırılıyor.
     *
     * Sonradan sınıflandırmak da mümkündü ama yanlış olurdu: mesaj kutuya
     * sınıfsız düşerse operatör onu zaten görür ve iş, çözmesi gereken sorunu
     * bir kez daha üretir (P1-18).
     */
    const classification = classifyInboxMessage({
      from: (from as string) || "unknown",
      subject: (subject as string) || null,
      raw: body,
    });

    /**
     * RFC Message-ID: panelden verilen cevabın `In-Reply-To` başlığı bunu ister —
     * yoksa cevap misafirin kutusunda ayrı bir konu olarak açılır.
     */
    let inboundMessageId: string | null = null;
    const rawMsgId = (data as { message_id?: unknown }).message_id;
    if (typeof rawMsgId === "string" && rawMsgId.trim()) {
      inboundMessageId = rawMsgId.trim();
    } else {
      const hdrs = (data as { headers?: unknown }).headers ?? (body as { headers?: unknown }).headers;
      if (hdrs && typeof hdrs === "object") {
        const hv = (hdrs as Record<string, unknown>)["message-id"] ?? (hdrs as Record<string, unknown>)["Message-ID"] ?? (hdrs as Record<string, unknown>)["Message-Id"];
        if (typeof hv === "string" && hv.trim()) inboundMessageId = hv.trim();
      }
    }

    await prisma.contactMessage.create({
      data: {
        from: (from as string) || "unknown",
        to: toAddress as string,
        subject: subject || "No Subject",
        inboundMessageId,
        text: typeof text === "string" ? text : JSON.stringify(text),
        html: typeof html === "string" ? html : JSON.stringify(html),
        raw: (body as object) || {}, // Tam payload'u her zaman saklıyoruz
        isRead: false,
        category: classification.category,
        categoryReason: classification.reason,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    /*
      Ham hata metni ISTEMCIYE GITMEZ (proje kurali; `bookings/lookup` ve
      `guest-cancel` bunu 2026-08-25'te uygulamisti, bu uc atlanmisti).
      `error.message` bir Prisma sorgusunu, dosya yolunu ya da sema adini disari
      tasiyabiliyordu -- ve bu uc KIMLIK DOGRULAMASIZ cagrilabilen bir adres:
      gecersiz imzayla degil ama gecerli imzayla bozuk govde gondererek ic
      yapiyi okumak mumkundu. Sebep log'a, istemciye sabit bir kod.
    */
    logger.error({ err: error }, "resend_webhook_failed");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

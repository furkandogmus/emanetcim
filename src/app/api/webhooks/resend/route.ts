import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Resend } from "resend";
import { normalizeInboundSubjectLine } from "@/lib/reply-subject";

export const dynamic = 'force-dynamic';

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
  return new Resend(key);
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    // Basit Güvenlik Kontrolü (Eğer env'de tanımlıysa)
    if (process.env.RESEND_WEBHOOK_SECRET && token !== process.env.RESEND_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    /**
     * Resend Hibrit Webhook İşleme (Flat vs Nested)
     * Bazı eventler { type, data: { ... } } formatında, Inbound olanlar ise düz { from, subject, text } formatında gelir.
     */
    const isNested = !!body.data && typeof body.data === 'object';
    const data = isNested ? body.data : body;
    
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
    let text = data.text || data.content?.text || data.body || data.snippet || "";
    let html = data.html || data.content?.html || "";

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
        try {
          // Resend webhook'u çok hızlı tetikliyor, email henüz API'ye yansımamış (404) olabilir.
          // 3 saniye (3000ms) bekleyip öyle çekmeyi deneyelim (Race condition çözümü).
          await new Promise((resolve) => setTimeout(resolve, 3000));

          const fullEmail = await resend.emails.receiving.get(email_id);
          if (fullEmail?.data) {
            text = fullEmail.data.text || text;
            html = fullEmail.data.html || html;
          } else if (fullEmail?.error) {
            fetchErrorMsg = JSON.stringify(fullEmail.error);
          }
        } catch (fetchError: unknown) {
          console.error("[Resend Webhook Fetch Error]", fetchError);
          fetchErrorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        }
      }
    }

    // Eğer hala hiçbir içerik yoksa, tüm body'yi text olarak kaydedelim ki admin ne geldiğini görebilsin
    if (!text && !html) {
      const headLine = subject
        ? `Konu: ${subject}\nKonu (Re/yanıt zinciri) webhookta mevcut; gövde Resend API'de henüz okunamadı.\n\n`
        : "";
      if (fetchAttempted) {
        text =
          `Gelen ileti (gövde API’den alınamadı).\n${headLine}Hata: ${fetchErrorMsg}\n\nHam veri:\n` +
          JSON.stringify(body, null, 2);
      } else {
        text =
          `[Otomatik Yakalama] İçerik bulunamadı (email_id yok).\n${headLine}` +
          JSON.stringify(body, null, 2);
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

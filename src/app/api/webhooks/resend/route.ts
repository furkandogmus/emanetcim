import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    const { from, to, subject, email_id } = data;
    
    // Başlangıç değerleri (webhook içinden gelenler)
    let text = data.text || data.content?.text || data.body || data.snippet || "";
    let html = data.html || data.content?.html || "";

    /**
     * EĞER İÇERİK BOŞ VE email_id VARSA:
     * Resend'den tam e-posta içeriğini API yoluyla çekelim.
     * (E-posta bildirimlerinde içerik doğrudan payload'da olmayabilir.)
     */
    if ((!text && !html) && email_id) {
      try {
        const fullEmail = await resend.emails.get(email_id);
        if (fullEmail?.data) {
          text = fullEmail.data.text || text;
          html = fullEmail.data.html || html;
        }
      } catch (fetchError) {
        console.error("[Resend Webhook Fetch Error]", fetchError);
        // Hata durumunda webhook içindeki kısıtlı bilgiyle devam edilir.
      }
    }

    // Eğer hala hiçbir içerik yoksa, tüm body'yi text olarak kaydedelim ki admin ne geldiğini görebilsin
    if (!text && !html) {
      text = "[Otomatik Yakalama] İçerik bulunamadı. Ham Veri:\n" + JSON.stringify(body, null, 2);
    }

    // Resend gönderilen adresleri array olarak veriyor olabilir
    const toAddress = Array.isArray(to) ? to.join(", ") : (to || "unknown");

    await prisma.contactMessage.create({
      data: {
        from: from || "unknown",
        to: toAddress,
        subject: subject || "No Subject",
        text: typeof text === "string" ? text : JSON.stringify(text),
        html: typeof html === "string" ? html : JSON.stringify(html),
        raw: body, // Tam payload'u her zaman saklıyoruz
        isRead: false,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error("[Resend Webhook Error]", error);
    return NextResponse.json({ error: "Internal Server Error", details: error?.message }, { status: 500 });
  }
}

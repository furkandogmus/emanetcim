import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    // Basit Güvenlik Kontrolü (Eğer env'de tanımlıysa)
    if (process.env.RESEND_WEBHOOK_SECRET && token !== process.env.RESEND_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Sadece "email.received" tipindeki event'leri yakalıyoruz
    if (body.type !== "email.received") {
      return NextResponse.json({ message: "Ignored event type." }, { status: 200 });
    }

    const data = body.data || {};
    const { from, to, subject } = data;
    
    // Robust Content Extraction
    const text = data.text || data.content?.text || data.body || "";
    const html = data.html || data.content?.html || "";

    // Resend gönderilen adresleri array olarak veriyor olabilir
    const toAddress = Array.isArray(to) ? to.join(", ") : to;

    await prisma.contactMessage.create({
      data: {
        from: from || "unknown",
        to: toAddress || "unknown",
        subject: subject || "No Subject",
        text: typeof text === "string" ? text : JSON.stringify(text),
        html: typeof html === "string" ? html : JSON.stringify(html),
        raw: body, // Tam payload'u saklıyoruz
        isRead: false,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[Resend Webhook Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

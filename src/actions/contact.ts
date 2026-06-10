"use server";

import prisma from "@/lib/db";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  message: z.string().min(5).max(2000),
});

export type ContactFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; error: string };

export async function sendContactMessageAction(
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";
  const allowed = await rateLimit(`contact:${ip}`, 3, 60_000);
  if (!allowed) {
    return { status: "error", error: "too_many_requests" };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { status: "error", error: "invalid" };
  }

  const { name, email, message } = parsed.data;

  try {
    await prisma.contactMessage.create({
      data: {
        from: `${name} <${email}>`,
        to: "destek@bagajpark.com",
        subject: `İletişim Formu: ${name}`,
        text: message,
      },
    });
    return { status: "success" };
  } catch {
    return { status: "error", error: "server" };
  }
}

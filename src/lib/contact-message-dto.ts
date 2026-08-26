import type { ContactMessage, ContactReply } from "@prisma/client";

/**
 * Server → Client bileşen sınırında React Flight ile güvenle iletilebilir düz nesne.
 * Prisma `Date` doğrudan bazen RSC serileştirmesinde sorun çıkarır.
 */
export type ContactReplyDTO = {
  id: string;
  body: string;
  fromEmail: string;
  createdAt: string;
};

export type ContactMessageDTO = {
  id: string;
  from: string;
  to: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  isRead: boolean;
  createdAt: string;
  /** SUPPORT | BULK | AUTOMATED | UNCLASSIFIED */
  category: string;
  categoryReason: string | null;
  /** Panelden verilmiş cevaplar (eskiden yeniye). */
  replies: ContactReplyDTO[];
};

export function toContactMessageDTOList(
  rows: (ContactMessage & { replies?: ContactReply[] })[],
): ContactMessageDTO[] {
  return rows.map((m) => ({
    id: m.id,
    from: m.from,
    to: m.to,
    subject: m.subject,
    text: m.text,
    html: m.html,
    isRead: m.isRead,
    createdAt: m.createdAt.toISOString(),
    category: m.category,
    categoryReason: m.categoryReason,
    replies: (m.replies ?? []).map((r) => ({
      id: r.id,
      body: r.body,
      fromEmail: r.fromEmail,
      createdAt: r.createdAt.toISOString(),
    })),
  }));
}

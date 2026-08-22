import type { ContactMessage } from "@prisma/client";

/**
 * Server → Client bileşen sınırında React Flight ile güvenle iletilebilir düz nesne.
 * Prisma `Date` doğrudan bazen RSC serileştirmesinde sorun çıkarır.
 */
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
};

export function toContactMessageDTOList(rows: ContactMessage[]): ContactMessageDTO[] {
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
  }));
}

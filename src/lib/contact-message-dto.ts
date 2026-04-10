import type { ContactMessage, Prisma } from "@prisma/client";

/**
 * Server → Client bileşen sınırında React Flight ile güvenle iletilebilir düz nesne.
 * Prisma `Date` / `Json` tipleri doğrudan bazen RSC serileştirmesinde sorun çıkarır.
 */
export type ContactMessageDTO = {
  id: string;
  from: string;
  to: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  isRead: boolean;
  raw: Prisma.JsonValue | null;
  createdAt: string;
};

function safeJsonClone(value: Prisma.JsonValue | null): Prisma.JsonValue | null {
  if (value == null) return value;
  try {
    return JSON.parse(
      JSON.stringify(value, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    ) as Prisma.JsonValue;
  } catch {
    return { _serializationNote: "raw payload could not be cloned" };
  }
}

export function toContactMessageDTOList(rows: ContactMessage[]): ContactMessageDTO[] {
  return rows.map((m) => ({
    id: m.id,
    from: m.from,
    to: m.to,
    subject: m.subject,
    text: m.text,
    html: m.html,
    isRead: m.isRead,
    raw: safeJsonClone(m.raw),
    createdAt: m.createdAt.toISOString(),
  }));
}

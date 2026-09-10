import { Prisma } from "@prisma/client";

/**
 * Admin gelen kutusu listesi — web VE mobil ucun ORTAK sorgu sekli.
 *
 * NEDEN VAR (2026-09-10'da bulundu): `prisma.contactMessage.findMany()` ne
 * `take` ne `select` tasiyordu -- panel her acildiginda tablodaki TUM
 * mesajlar tum sutunlariyla cekiliyordu. `raw` (gelen e-postanin ham JSON
 * temsili) `AdminMessagesClient.tsx`'te HIC OKUNMUYOR ama en agir sutun;
 * disarida birakildi. `html`/`text` genisletilmis satir gorunumunde
 * kullanildigi icin (ayri bir detay ucu yok, liste zaten tasiyor) listede
 * KALMAK ZORUNDA.
 */
export const CONTACT_MESSAGE_LIST_TAKE = 200;

export const CONTACT_MESSAGE_LIST_SELECT = {
  id: true,
  from: true,
  to: true,
  subject: true,
  text: true,
  html: true,
  isRead: true,
  createdAt: true,
  category: true,
  categoryReason: true,
  inboundMessageId: true,
} satisfies Prisma.ContactMessageSelect;

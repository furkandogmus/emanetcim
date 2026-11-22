import type { BroadcastAudience, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit-log";
import { ANONYMIZED_EMAIL_DOMAIN } from "@/lib/anonymized-account";
import {
  BROADCAST_MIN_INTERVAL_MS,
  BROADCAST_REASON_MAX,
  BROADCAST_REASON_MIN,
  BROADCAST_STUCK_MS,
  parseAudience,
  parseBroadcastContent,
  pickBroadcastText,
  type BroadcastContent,
} from "@/lib/broadcast";
import { notificationService } from "@/services/NotificationService";

/**
 * Yonetici "Duyuru gonder": operasyonel push yayini. Yalniz mobil cihazlara
 * (`MobilePushToken`) gider; web push aboneligi hedef kitleye girmez.
 * Pazarlama mesaji bu yoldan gonderilmez: ticari ileti onayi toplanmiyor.
 */

/** Ayni anda iki gonderim kontrolu gecmesin diye islem ici kilit anahtari. */
const BROADCAST_LOCK_KEY = 7_241_001;
const CHUNK_SIZE = 50;
const CONCURRENCY = 2;

export type BroadcastActor = { id: string; impersonatedBy?: string };

/**
 * Hedef kitle: rol filtresi (ADMIN hicbir secenekte yok), yasakli ve
 * anonimlestirilmis hesap disarida, en az bir kayitli mobil cihaz sart.
 * E-postasi bos (telefonla kayitli) kullanici `NOT endsWith`'e takilmasin diye
 * `OR` ile acikca iceri alinir: SQL'de NULL karsilastirmasi satiri dusurur.
 */
export function audienceUserWhere(audience: BroadcastAudience): Prisma.UserWhereInput {
  const role: Prisma.UserWhereInput["role"] =
    audience === "PARTNERS" ? "PARTNER" : audience === "GUESTS" ? "GUEST" : { in: ["PARTNER", "GUEST"] };
  return {
    role,
    isBanned: false,
    OR: [{ email: null }, { NOT: { email: { endsWith: ANONYMIZED_EMAIL_DOMAIN } } }],
    mobilePushTokens: { some: {} },
  };
}

export async function previewBroadcast(audienceRaw: unknown) {
  const audience = parseAudience(audienceRaw);
  if (!audience) return { ok: false as const, code: "invalid_audience" as const };
  const where = audienceUserWhere(audience);
  const [users, devices] = await Promise.all([
    prisma.user.count({ where }),
    prisma.mobilePushToken.count({ where: { user: where } }),
  ]);
  return { ok: true as const, users, devices };
}

type Device = { token: string; locale: string | null };

/** Cihazlari dile gore ayirip `CHUNK_SIZE`'lik parcalar halinde, `CONCURRENCY` paralel gonderir. */
async function deliverToDevices(
  devices: Device[],
  content: BroadcastContent,
  onChunk: (r: { sent: number; failed: number }) => Promise<void>,
  logCtx: Record<string, unknown>,
) {
  const jobs: { tokens: string[]; title: string; body: string }[] = [];
  const byLang = new Map<string, { title: string; body: string; tokens: string[] }>();
  for (const d of devices) {
    const t = pickBroadcastText(content, d.locale);
    const g = byLang.get(t.lang) ?? { title: t.title, body: t.body, tokens: [] };
    g.tokens.push(d.token);
    byLang.set(t.lang, g);
  }
  for (const g of byLang.values()) {
    for (let i = 0; i < g.tokens.length; i += CHUNK_SIZE) {
      jobs.push({ tokens: g.tokens.slice(i, i + CHUNK_SIZE), title: g.title, body: g.body });
    }
  }

  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      let sent = 0;
      let failed = 0;
      // Bir parcanin hatasi (FCM kimligi, ag) digerlerini durdurmaz; parca basarisiz sayilir.
      try {
        const r = await notificationService.deliverMobilePush(job.tokens, job.title, job.body, undefined, logCtx);
        sent = r.sent;
        failed = r.failed + r.skipped;
      } catch (err) {
        logger.warn({ ...logCtx, err, size: job.tokens.length }, "broadcast_chunk_failed");
        failed = job.tokens.length;
      }
      await onChunk({ sent, failed });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
}

/** "Kendime test gonder": yalniz cagiran yoneticinin kendi cihazlari; sinira sayilmaz, kayit acmaz. */
export async function sendBroadcastTest(actor: BroadcastActor, raw: Record<string, unknown>) {
  if (actor.impersonatedBy) return { ok: false as const, code: "forbidden" as const };
  const parsed = parseBroadcastContent(raw);
  if (!parsed.ok) return { ok: false as const, code: parsed.error };
  const devices = await prisma.mobilePushToken.findMany({
    where: { userId: actor.id },
    select: { token: true, locale: true },
  });
  if (devices.length > 0) {
    await deliverToDevices(devices, parsed.content, async () => {}, { broadcast: "test", userId: actor.id });
  }
  writeAuditLog({
    actorUserId: actor.id,
    actorRole: "ADMIN",
    action: "admin.broadcast.test",
    metadata: { devices: devices.length, titleTr: parsed.content.titleTr },
  });
  return { ok: true as const, devices: devices.length };
}

export type CreateBroadcastResult =
  | { ok: true; id: string; devices: number }
  | {
      ok: false;
      code:
        | "forbidden"
        | "invalid_audience"
        | "invalid_title"
        | "invalid_body"
        | "reason_required"
        | "no_recipients";
    }
  | { ok: false; code: "too_soon"; retryAfterSeconds: number };

/**
 * Kaydi QUEUED acar ve hemen doner; teslimi `startBroadcastDelivery` arka planda yapar.
 * Sinir kontrolu ile kayit ayni islemde, danisma kilidi altinda: iki yoneticinin ayni
 * anda bastigi "Gonder" iki duyuru cikarmasin.
 */
export async function createBroadcast(
  actor: BroadcastActor,
  raw: Record<string, unknown>,
  opts: { ip?: string | null; now?: Date } = {},
): Promise<CreateBroadcastResult> {
  if (actor.impersonatedBy) return { ok: false, code: "forbidden" };
  const audience = parseAudience(raw.audience);
  if (!audience) return { ok: false, code: "invalid_audience" };
  const parsed = parseBroadcastContent(raw);
  if (!parsed.ok) return { ok: false, code: parsed.error };
  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  if (Array.from(reason).length < BROADCAST_REASON_MIN) return { ok: false, code: "reason_required" };
  const content = parsed.content;
  const now = opts.now ?? new Date();

  const result = await prisma.$transaction(async (tx): Promise<CreateBroadcastResult> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BROADCAST_LOCK_KEY}::bigint)`;
    const last = await tx.broadcast.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (last) {
      const waitMs = last.createdAt.getTime() + BROADCAST_MIN_INTERVAL_MS - now.getTime();
      if (waitMs > 0) return { ok: false, code: "too_soon", retryAfterSeconds: Math.ceil(waitMs / 1000) };
    }
    const devices = await tx.mobilePushToken.count({ where: { user: audienceUserWhere(audience) } });
    if (devices === 0) return { ok: false, code: "no_recipients" };
    const row = await tx.broadcast.create({
      data: {
        audience,
        ...content,
        reason: reason.slice(0, BROADCAST_REASON_MAX),
        createdById: actor.id,
        targetedDevices: devices,
        status: "QUEUED",
      },
      select: { id: true },
    });
    return { ok: true, id: row.id, devices };
  });

  if (result.ok) {
    writeAuditLog({
      actorUserId: actor.id,
      actorRole: "ADMIN",
      action: "admin.broadcast.send",
      entityType: "Broadcast",
      entityId: result.id,
      metadata: { audience, devices: result.devices, reason, titleTr: content.titleTr },
      ip: opts.ip ?? null,
    });
  }
  return result;
}

/**
 * Arka plan teslimi. Cihaz listesi bu anda yeniden okunur (kayit ile baslangic
 * arasinda token silinmis olabilir) ve `targetedDevices` gercek sayiya cekilir.
 * Bitis yalniz satir hala SENDING ise yazilir: listeleme onu asili diye FAILED'a
 * cektiyse geri DONE yapilmaz.
 */
export async function deliverBroadcast(id: string): Promise<void> {
  const b = await prisma.broadcast.findUnique({ where: { id } });
  if (!b || b.status !== "QUEUED") return;
  const devices = await prisma.mobilePushToken.findMany({
    where: { user: audienceUserWhere(b.audience) },
    select: { token: true, locale: true },
  });
  await prisma.broadcast.update({
    where: { id },
    data: { status: "SENDING", startedAt: new Date(), targetedDevices: devices.length },
  });

  let sent = 0;
  let failed = 0;
  await deliverToDevices(
    devices,
    { titleTr: b.titleTr, bodyTr: b.bodyTr, titleEn: b.titleEn, bodyEn: b.bodyEn },
    async (r) => {
      sent += r.sent;
      failed += r.failed;
      await prisma.broadcast.update({
        where: { id },
        data: { sent: { increment: r.sent }, failed: { increment: r.failed } },
      });
    },
    { broadcastId: id },
  );

  await prisma.broadcast.updateMany({
    where: { id, status: "SENDING" },
    data: { status: sent === 0 && failed > 0 ? "FAILED" : "DONE", finishedAt: new Date() },
  });
  logger.info({ broadcastId: id, sent, failed, targeted: devices.length }, "broadcast_done");
}

/** Ates-unut: istek 202 ile doner, teslim surec icinde devam eder. */
export function startBroadcastDelivery(id: string): void {
  void deliverBroadcast(id).catch(async (err) => {
    logger.error({ err, broadcastId: id }, "broadcast_delivery_failed");
    await prisma.broadcast
      .updateMany({
        where: { id, status: { in: ["QUEUED", "SENDING"] } },
        data: { status: "FAILED", finishedAt: new Date() },
      })
      .catch((e) => logger.error({ err: e, broadcastId: id }, "broadcast_mark_failed_failed"));
  });
}

/**
 * Son duyurular. Sunucu teslim sirasinda yeniden baslarsa satir SENDING'de kalir;
 * cron eklemeden burada temizlenir: 30 dakikadir ilerlemeyen (updatedAt) QUEUED/SENDING
 * satir FAILED olur. Her parca sayaclari guncelledigi icin uzun ama ilerleyen gonderim etkilenmez.
 */
export async function listBroadcasts(limitRaw: unknown, now: Date = new Date()) {
  const n = Number(limitRaw);
  const limit = Number.isFinite(n) && n >= 1 ? Math.min(50, Math.floor(n)) : 20;
  await prisma.broadcast.updateMany({
    where: {
      status: { in: ["QUEUED", "SENDING"] },
      updatedAt: { lt: new Date(now.getTime() - BROADCAST_STUCK_MS) },
    },
    data: { status: "FAILED", finishedAt: now },
  });
  const rows = await prisma.broadcast.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  const ids = [...new Set(rows.map((r) => r.createdById))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : [];
  const names = new Map(users.map((u) => [u.id, u.name ?? u.email ?? ""]));
  return rows.map((r) => ({ ...r, createdByName: names.get(r.createdById) ?? "" }));
}

"use server";

import { getClientIpOrNull } from "@/lib/client-ip";
import { requireAdmin } from "@/lib/action-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import {
  createBroadcast,
  previewBroadcast,
  sendBroadcastTest,
  startBroadcastDelivery,
} from "@/services/BroadcastService";

/*
  Web "Duyuru gonder". Mobil `admin/broadcasts` uclariyla ayni `BroadcastService`:
  dogrulama, 10 dk siniri, tek seferde tek gonderim kilidi, test sinirlari ve denetim kaydi orada.
  Kanal yine yalniz mobil push. Hata kodlari servisin kodlari (`AdminBroadcast.error_<kod>`).
*/

export type BroadcastActionError = { ok: false; error: string; retryAfterSeconds?: number };

function body(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export async function previewBroadcastAction(
  audience: unknown,
): Promise<{ ok: true; users: number; devices: number } | BroadcastActionError> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const r = await previewBroadcast(audience);
  return r.ok ? { ok: true, users: r.users, devices: r.devices } : { ok: false, error: r.code };
}

export async function sendBroadcastTestAction(
  raw: unknown,
): Promise<{ ok: true; devices: number } | BroadcastActionError> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { titleTr, bodyTr, titleEn, bodyEn } = body(raw);
  const r = await sendBroadcastTest({ id: auth.actor.id }, { titleTr, bodyTr, titleEn, bodyEn });
  if (r.ok) return { ok: true, devices: r.devices };
  return r.code === "too_soon"
    ? { ok: false, error: r.code, retryAfterSeconds: r.retryAfterSeconds }
    : { ok: false, error: r.code };
}

export async function sendBroadcastAction(
  raw: unknown,
): Promise<{ ok: true; id: string; devices: number } | BroadcastActionError> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { audience, titleTr, bodyTr, titleEn, bodyEn, reason } = body(raw);
  const r = await createBroadcast(
    { id: auth.actor.id },
    { audience, titleTr, bodyTr, titleEn, bodyEn, reason },
    { ip: await getClientIpOrNull() },
  );
  if (!r.ok) {
    return r.code === "too_soon"
      ? { ok: false, error: r.code, retryAfterSeconds: r.retryAfterSeconds }
      : { ok: false, error: r.code };
  }
  startBroadcastDelivery(r.id);
  revalidatePathAllLocales("/admin/broadcast");
  return { ok: true, id: r.id, devices: r.devices };
}

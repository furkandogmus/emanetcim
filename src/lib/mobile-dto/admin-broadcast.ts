type AdminBroadcastSource = {
  id: string;
  audience: string;
  titleTr: string;
  bodyTr: string;
  status: string;
  targetedDevices: number;
  sent: number;
  failed: number;
  createdAt: Date;
  finishedAt: Date | null;
  createdByName: string;
};

/** `admin/broadcasts` gecmis satiri. Gerekce ve Ingilizce metin listede tasinmaz (denetim kaydinda durur). */
export function toMobileAdminBroadcast(b: AdminBroadcastSource) {
  return {
    id: b.id,
    audience: b.audience,
    titleTr: b.titleTr,
    bodyTr: b.bodyTr,
    status: b.status,
    targetedDevices: b.targetedDevices,
    sent: b.sent,
    failed: b.failed,
    createdAt: b.createdAt.toISOString(),
    finishedAt: b.finishedAt?.toISOString() ?? null,
    createdByName: b.createdByName,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { deleteBagPhotoAction, listBagPhotosAction, uploadBagPhotoAction } from "@/actions/bag-photos";
import { compressToJpeg } from "@/components/bag-photos/compress";
import type { BagPhotoList } from "@/services/BagPhotoService";

type Audience = "operator" | "guest" | "admin";

const KNOWN_ERRORS = new Set([
  "forbidden",
  "read_only",
  "storage_unavailable",
  "rate_limited",
  "locked",
  "limit",
  "empty",
  "too_large",
  "unsupported_type",
  "dimensions_too_large",
]);

/**
 * Valiz durumu fotograflari: operator teslimde ekler/siler, misafir ve yonetici gorur.
 * Adresler 5 dk gecerli imzali URL; suresi dolan gorsel listeyi bir kez yeniden ister.
 * Yukleme hatasi teslimi ENGELLEMEZ: kart hatayi ve "tekrar dene"yi gosterir.
 */
export default function BagPhotos({ bookingId, audience }: { bookingId: string; audience: Audience }) {
  const t = useTranslations("bagPhotos");
  const [list, setList] = useState<BagPhotoList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const lastRefresh = useRef(0);

  const refresh = useCallback(async () => {
    lastRefresh.current = Date.now();
    const r = await listBagPhotosAction(bookingId).catch(() => null);
    if (r?.success) setList(r.data);
  }, [bookingId]);

  useEffect(() => {
    let cancelled = false;
    void listBagPhotosAction(bookingId)
      .then((r) => {
        if (!cancelled && r.success) setList(r.data);
      })
      .catch(() => undefined);
    lastRefresh.current = Date.now();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const errorText = (code: string) => (KNOWN_ERRORS.has(code) ? t(`errors.${code}`) : t("errors.generic"));

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const jpeg = await compressToJpeg(file);
      const form = new FormData();
      form.append("file", jpeg, "bag.jpg");
      const r = await uploadBagPhotoAction(bookingId, form);
      if (!r.success) {
        setError(errorText(r.code));
        setRetryFile(r.code === "limit" || r.code === "locked" || r.code === "forbidden" ? null : file);
        return;
      }
      setRetryFile(null);
      await refresh();
    } catch {
      setError(t("errors.generic"));
      setRetryFile(file);
    } finally {
      setBusy(false);
    }
  }

  async function remove(photoId: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    setBusy(true);
    setError(null);
    const r = await deleteBagPhotoAction(bookingId, photoId).catch(() => null);
    if (!r?.success) setError(errorText(r?.code ?? "generic"));
    await refresh();
    setBusy(false);
  }

  if (!list || !list.storageReady) return null;
  const { photos, canUpload, canDelete, maxPhotos } = list;
  if (photos.length === 0 && !canUpload) return null;
  const inputId = `bag-photo-${bookingId}`;

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex items-start gap-3">
        <Camera size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 id={`${inputId}-title`} className="text-xs id-eyebrow text-gray-600">
            {t(audience === "operator" ? "operatorTitle" : "title")}
          </h4>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            {t(audience === "operator" ? "operatorHint" : audience === "guest" ? "guestHint" : "adminHint", { max: maxPhotos })}
          </p>
        </div>
      </div>

      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <li key={p.id} className="relative">
              <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={t("openPhoto", { n: i + 1 })}>
                {/* eslint-disable-next-line @next/next/no-img-element -- imzali ozel adres, optimize edilmez */}
                <img
                  src={p.url}
                  alt={t("photoAlt", { n: i + 1 })}
                  className="h-24 w-24 rounded-xl object-cover"
                  onError={() => {
                    if (Date.now() - lastRefresh.current > 30_000) void refresh();
                  }}
                />
              </a>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => void remove(p.id)}
                  disabled={busy}
                  aria-label={t("deletePhoto", { n: i + 1 })}
                  className="absolute -right-1 -top-1 rounded-full bg-white p-1.5 text-red-600 shadow ring-1 ring-gray-200 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          <span>{error}</span>
          {retryFile && (
            <button
              type="button"
              onClick={() => void upload(retryFile)}
              disabled={busy}
              className="inline-flex items-center gap-1 underline disabled:opacity-50"
            >
              <RotateCcw size={12} />
              {t("retry")}
            </button>
          )}
        </div>
      )}

      {canUpload && photos.length < maxPhotos && (
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
          <label
            htmlFor={inputId}
            className="id-control inline-flex cursor-pointer items-center gap-2 border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {t(photos.length === 0 ? "add" : "addMore", { count: photos.length, max: maxPhotos })}
          </label>
        </div>
      )}
    </section>
  );
}

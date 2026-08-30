"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, X } from "lucide-react";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";

const READER_ID = "partner-qr-reader";

/**
 * Yapıştırılan metinden rezervasyon kimliğini çıkarır.
 *
 * Esnaf pratikte iki şeyden birini yapıştırır: kimliğin kendisi ya da misafirin
 * ekranındaki bağlantı (`.../bookings/<id>`, `?booking=<id>`). Bağlantıyı
 * reddetmek, kullanıcıyı elle kırpmaya zorlamak olurdu — ve bu ekran zaten
 * "kamera çalışmadı" durumunda açılıyor, yani işlerin zaten ters gittiği an.
 * Hiçbir kimlik bulunamazsa metin OLDUĞU GİBİ gönderilir: sunucu imzalı QR
 * jetonunu da çözebiliyor.
 */
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function extractBookingRef(raw: string): string {
  const text = raw.trim();
  return text.match(UUID_RE)?.[0] ?? text;
}

const SCAN_CONFIG = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
} as const;

type Phase = "starting" | "scanning" | "needTap" | "error";

interface QRScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

async function startWithCamera(
  h: Html5Qrcode,
  preferredDeviceId: string | null,
  onDecoded: (text: string) => void,
  onFrameFail: () => void
): Promise<void> {
  let cameras: { id: string; label: string }[] = [];
  try {
    cameras = await Html5Qrcode.getCameras();
  } catch {
    cameras = [];
  }

  const preferred = preferredDeviceId
    ? cameras.find((c) => c.id === preferredDeviceId)
    : null;
  const tryOrder = [
    ...(preferred ? [preferred] : []),
    ...cameras.filter((c) => /back|rear|environment|arka/i.test(c.label)),
    ...cameras,
  ];
  const tried = new Set<string>();
  let lastErr: unknown;

  if (cameras.length > 0) {
    for (const cam of tryOrder) {
      if (tried.has(cam.id)) continue;
      tried.add(cam.id);
      try {
        await h.start(cam.id, { ...SCAN_CONFIG }, onDecoded, onFrameFail);
        return;
      } catch (e) {
        lastErr = e;
        if (h.isScanning) {
          try {
            await h.stop();
          } catch {
            /* ignore */
          }
        }
        try {
          h.clear();
        } catch {
          /* ignore */
        }
      }
    }
  }

  const constraintsAttempts: MediaTrackConstraints[] = [
    { facingMode: "environment" },
    { facingMode: "user" },
  ];
  for (const constraints of constraintsAttempts) {
    try {
      await h.start(constraints, { ...SCAN_CONFIG }, onDecoded, onFrameFail);
      return;
    } catch (e) {
      lastErr = e;
      if (h.isScanning) {
        try {
          await h.stop();
        } catch {
          /* ignore */
        }
      }
      try {
        h.clear();
      } catch {
        /* ignore */
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export default function QRScanner({ onResult, onClose }: QRScannerProps) {
  const t = useTranslations("Partner");
  const tCommon = useTranslations("Common");

  /**
   * Kamera katmani tam ekrani kapliyor ve Escape ile kapanmiyordu — kamera
   * izni reddedilmis bir klavye kullanicisi icin cikissiz bir ekran.
   * Kapat dugmesinin adi da sabit Turkce yazilmisti; urun 14 dil destekliyor.
   */
  useModalBehavior({ open: true, onClose });

  const html5Ref = useRef<Html5Qrcode | null>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const [phase, setPhase] = useState<Phase>("starting");
  const [manualRef, setManualRef] = useState("");
  /**
   * Hata METNİ değil ANAHTARI tutuluyor.
   *
   * Eskiden üç kamera hatası da sabit Türkçe metindi: esnaf 6 dilin hepsinde
   * Türkçe okuyordu ve metin `src/locales`'e hiç uğramıyordu.
   */
  const [errorKey, setErrorKey] = useState<
    "qrNeedsHttps" | "qrPermissionFailed" | "qrBusy" | null
  >(null);
  const runIdRef = useRef(0);

  const stopAndClear = useCallback(async () => {
    const h = html5Ref.current;
    if (!h) return;
    if (h.isScanning) {
      try {
        await h.stop();
      } catch (e) {
        console.error("QR stop failed", e);
      }
    }
    try {
      h.clear();
    } catch {
      /* ignore */
    }
  }, []);

  const runStart = useCallback(async (userInitiated = false) => {
    const id = ++runIdRef.current;
    setPhase("starting");
    setErrorKey(null);

    await stopAndClear();
    if (id !== runIdRef.current) return;
    html5Ref.current = null;

    const h = new Html5Qrcode(READER_ID, { verbose: false });
    if (id !== runIdRef.current) {
      try {
        h.clear();
      } catch {
        /* ignore */
      }
      return;
    }
    html5Ref.current = h;

    const onDecoded = (decodedText: string) => {
      void (async () => {
        await stopAndClear();
        html5Ref.current = null;
        onResultRef.current(decodedText);
      })();
    };
    const onFrameFail = () => {};

    let preferredDeviceId: string | null = null;
    try {
      // Some mobile browsers require user interaction before camera access.
      if (userInitiated && navigator.mediaDevices?.getUserMedia) {
        try {
          const warmup = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
          preferredDeviceId = warmup.getVideoTracks()[0]?.getSettings().deviceId ?? null;
          warmup.getTracks().forEach((t) => t.stop());
        } catch {
          // Ignore warm-up failures and continue with html5-qrcode flow.
        }
      }

      await startWithCamera(h, preferredDeviceId, onDecoded, onFrameFail);
      if (id !== runIdRef.current) return;
      setPhase("scanning");
    } catch (e) {
      if (id !== runIdRef.current) return;
      console.error("QR camera start failed", e);
      const name =
        e && typeof e === "object" && "name" in e ? String((e as Error).name) : "";
      const message = e instanceof Error ? e.message : String(e);
      const isPermission =
        name === "NotAllowedError" ||
        name === "PermissionDeniedError" ||
        /not allowed|permission|denied/i.test(message);
      const isInsecureContext =
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        window.location.hostname !== "localhost";
      const isNoCamera =
        name === "NotFoundError" || /no camera|not found|requested device not found/i.test(message);

      try {
        h.clear();
      } catch {
        /* ignore */
      }
      html5Ref.current = null;

      if (isInsecureContext) {
        setPhase("error");
        setErrorKey("qrNeedsHttps");
      } else if (isPermission || isNoCamera) {
        setPhase("needTap");
        setErrorKey("qrPermissionFailed");
      } else {
        setPhase("error");
        setErrorKey("qrBusy");
      }
    }
  }, [stopAndClear]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void runStart();
    });
    return () => {
      cancelled = true;
      runIdRef.current += 1;
      void stopAndClear();
      html5Ref.current = null;
    };
  }, [runStart, stopAndClear]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scanner-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-[60] rounded-full bg-gray-100 p-2 transition-colors hover:bg-gray-200"
          aria-label={tCommon("close")}
        >
          <X size={24} className="text-gray-900" />
        </button>

        <div className="p-8">
          <h2
            id="qr-scanner-title"
            className="mb-2 text-center text-xl font-bold text-gray-900"
          >
            {t("qrScanTitle")}
          </h2>
          <p className="mb-6 text-center text-sm text-gray-500">
            {t("qrAimHint")}
          </p>

          <div className="relative min-h-[220px]">
            <div
              id={READER_ID}
              className="min-h-[220px] overflow-hidden rounded-2xl border-2 border-dashed border-gray-200"
            />
            {phase === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
                <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
              </div>
            )}
          </div>

          {/*
            ELLE GİRİŞ HER ZAMAN AÇIK.

            Önceden tek yol kameraydı: kamera izni reddedilmişse, webcam'i
            olmayan bir masaüstünde ya da misafirin telefonu bittiği için
            gösterecek QR yoksa esnaf valizi HİÇ teslim alamıyordu — ekranda
            "Kamerayı başlat"tan başka bir şey yoktu. Bagaj teslimi kameranın
            çalışmasına bağlı olamaz.

            Yetki sunucuda: `getPartnerBookingPreviewAction` rezervasyonun
            dükkanı esnafa ait değilse `Errors.unauthorized` döner. Yani elle
            kod yazmak başka bir dükkanın rezervasyonunu açmaz.
          */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = manualRef.trim();
              if (value === "") return;
              onResult(extractBookingRef(value));
            }}
            className="mt-6 flex flex-col gap-2 border-t border-gray-100 pt-5"
          >
            <label
              htmlFor="partner-manual-booking"
              className="text-xs id-eyebrow text-gray-500"
            >
              {t("qrManualLabel")}
            </label>
            <div className="flex gap-2">
              <input
                id="partner-manual-booking"
                type="text"
                inputMode="text"
                autoComplete="off"
                value={manualRef}
                onChange={(e) => setManualRef(e.target.value)}
                placeholder={t("qrManualPlaceholder")}
                aria-label={t("qrManualLabel")}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={manualRef.trim() === ""}
                className="btn-ui btn-ui-md btn-ui-primary shrink-0"
                data-testid="partner-manual-lookup"
              >
                {t("qrManualSubmit")}
              </button>
            </div>
            <p className="text-xs text-gray-400">{t("qrManualHint")}</p>
          </form>

          {(phase === "needTap" || phase === "error") && (
            <div className="mt-4 flex flex-col gap-3">
              {errorKey && (
                /* Sabit Türkçe metin yerine anahtar tutuluyor: kamera hatası da 6 dilde. */
                <p className="text-center text-sm text-gray-600" role="alert">
                  {t(errorKey)}
                </p>
              )}
              <button
                type="button"
                onClick={() => void runStart(true)}
                className="w-full rounded-2xl bg-orange-600 py-4 text-sm id-eyebrow text-white transition-colors hover:bg-orange-700"
              >
                {t("qrStartCamera")}
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-xs italic text-gray-400">
            {t("qrLiveOnlyNote")}
          </p>
        </div>
      </div>
    </div>
  );
}

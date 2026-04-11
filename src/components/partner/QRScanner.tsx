"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, X } from "lucide-react";

const READER_ID = "partner-qr-reader";

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
  onDecoded: (text: string) => void,
  onFrameFail: () => void
): Promise<void> {
  const cameras = await Html5Qrcode.getCameras();
  if (cameras.length === 0) {
    throw new Error("NO_CAMERAS");
  }

  const tryOrder = [
    ...cameras.filter((c) => /back|rear|environment|arka/i.test(c.label)),
    ...cameras,
  ];
  const tried = new Set<string>();
  let lastErr: unknown;

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
  const html5Ref = useRef<Html5Qrcode | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const runStart = useCallback(async () => {
    const id = ++runIdRef.current;
    setPhase("starting");
    setErrorMessage(null);

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

    try {
      await startWithCamera(h, onDecoded, onFrameFail);
      if (id !== runIdRef.current) return;
      setPhase("scanning");
    } catch (e) {
      if (id !== runIdRef.current) return;
      console.error("QR camera start failed", e);
      const name =
        e && typeof e === "object" && "name" in e ? String((e as Error).name) : "";
      const isPermission =
        name === "NotAllowedError" ||
        name === "PermissionDeniedError" ||
        (e instanceof Error && /not allowed|permission|denied/i.test(e.message));

      try {
        h.clear();
      } catch {
        /* ignore */
      }
      html5Ref.current = null;

      if (isPermission || name === "NotFoundError") {
        setPhase("needTap");
        setErrorMessage(
          "Kamera izni gerekli. Aşağıdaki düğmeye dokunarak tekrar deneyin."
        );
      } else {
        setPhase("error");
        setErrorMessage(
          "Kamera açılamadı. Bağlantıyı kontrol edip tekrar deneyin."
        );
      }
    }
  }, [stopAndClear]);

  useLayoutEffect(() => {
    void runStart();
    return () => {
      runIdRef.current += 1;
      void stopAndClear();
      html5Ref.current = null;
    };
  }, [runStart, stopAndClear]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-[60] rounded-full bg-gray-100 p-2 transition-colors hover:bg-gray-200"
          aria-label="Kapat"
        >
          <X size={24} className="text-gray-900" />
        </button>

        <div className="p-8">
          <h2 className="mb-2 text-center text-xl font-bold text-gray-900">
            QR Kodu Okutun
          </h2>
          <p className="mb-6 text-center text-sm text-gray-500">
            Misafirin telefonundaki QR kodu alanın içine getirin.
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

          {(phase === "needTap" || phase === "error") && (
            <div className="mt-4 flex flex-col gap-3">
              {errorMessage && (
                <p className="text-center text-sm text-gray-600">{errorMessage}</p>
              )}
              <button
                type="button"
                onClick={() => void runStart()}
                className="w-full rounded-2xl bg-orange-600 py-4 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-orange-700"
              >
                Kamerayı başlat
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-xs italic text-gray-400">
            Yalnızca canlı kamera ile okuma yapılır; galeri / dosya yükleme
            kullanılmaz.
          </p>
        </div>
      </div>
    </div>
  );
}

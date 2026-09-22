import QRCode from "qrcode";
import { ArrowRight, Camera, CheckCircle2 } from "lucide-react";

type Labels = {
  guestPhone: string;
  yourPhone: string;
  bookingQr: string;
  scanButton: string;
  scanned: string;
  bags: string;
};

/** Ornek icerik; gercek bir rezervasyona cozulmez. */
const SAMPLE_QR_CONTENT = "https://bagajpark.com/tr/esnaf/nasil-calisir";
const SAMPLE_GUEST = "Emma L.";

function MiniPhone({ caption, dark, children }: { caption: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <figure className="flex w-[9.5rem] shrink-0 flex-col items-center gap-2 sm:w-48">
      <div className="w-full rounded-4xl border-[5px] border-gray-900 bg-gray-900 shadow-xl shadow-gray-900/15">
        <div className={`flex aspect-[9/16] flex-col rounded-4xl p-3 ${dark ? "bg-gray-900" : "bg-white"}`}>
          <div className={`mx-auto mb-3 h-1 w-10 rounded-full ${dark ? "bg-gray-700" : "bg-gray-200"}`} />
          {children}
        </div>
      </div>
      <figcaption className="text-xs font-bold text-gray-500">{caption}</figcaption>
    </figure>
  );
}

/**
 * Esnafin QR ile teslim almasi: misafirin rezervasyon QR'i -> panelde kamera.
 * Sunucuda cizilir; QR bir SVG dizesi, istemciye JS gitmez.
 */
export default async function PartnerQrFlow({ labels }: { labels: Labels }) {
  const qrSvg = await QRCode.toString(SAMPLE_QR_CONTENT, {
    type: "svg",
    margin: 0,
    color: { dark: "#111827", light: "#ffffff" },
  });

  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-2 sm:gap-4">
      <MiniPhone caption={labels.guestPhone}>
        <p className="text-center text-[10px] font-bold uppercase tracking-wider text-brand-700">{labels.bookingQr}</p>
        <div className="mt-2 flex flex-1 items-center justify-center">
          <div
            className="w-full rounded-xl border border-gray-100 p-2 [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>
        <p className="mt-2 text-center font-mono text-[11px] font-bold tracking-wider text-gray-900">A3F9C21B</p>
      </MiniPhone>

      <ArrowRight className="shrink-0 text-brand-500" size={22} />

      <MiniPhone caption={labels.yourPhone} dark>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-gray-800">
          <div
            className="w-1/2 opacity-40 [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          {(["left-3 top-3 border-l-2 border-t-2", "right-3 top-3 border-r-2 border-t-2", "left-3 bottom-3 border-b-2 border-l-2", "right-3 bottom-3 border-b-2 border-r-2"] as const).map(
            (pos) => (
              <span key={pos} className={`absolute h-5 w-5 rounded-sm border-brand-400 ${pos}`} />
            ),
          )}
          <span className="absolute inset-x-4 top-1/2 h-0.5 bg-brand-400 shadow-[0_0_12px] shadow-brand-400 motion-safe:animate-pulse" />
        </div>
        <div className="mt-2 rounded-xl bg-emerald-50 p-2">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            <CheckCircle2 size={12} /> {labels.scanned}
          </p>
          <p className="mt-0.5 text-xs font-bold text-gray-900">{SAMPLE_GUEST}</p>
          <p className="text-[11px] text-gray-600">{labels.bags}</p>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 rounded-xl bg-brand-600 px-1.5 py-1.5 text-center text-[10px] font-bold leading-tight text-white">
          <Camera size={12} className="shrink-0" /> {labels.scanButton}
        </div>
      </MiniPhone>
    </div>
  );
}

import { APP_STORE_BADGE, GOOGLE_PLAY_BADGE, type AppStoreFlags } from "@/lib/app-stores-shared";

/**
 * Resmi magaza rozetleri, YALNIZCA yayindaki magazalar. Hooksuz: sunucu ve
 * istemci bilesenlerinden ayni sekilde cizilir.
 *
 * Rozet kurallari: renk/bicim degismez; App Store rozeti en az 40px yukseklik ve
 * yuksekliginin 1/4'u kadar bos alan (gap) ister. Google rozeti bos alanini
 * gorselin icinde tasir, bu yuzden 1.45 kat yuksek cizilir (gorunur yukseklik esit).
 */
export default function StoreBadges({
  flags,
  iosHref,
  androidHref,
  labels,
  height = 40,
  className = "",
}: {
  flags: AppStoreFlags;
  iosHref: string;
  androidHref: string;
  labels: { appStore: string; googlePlay: string };
  /** App Store rozetinin yuksekligi (px), en az 40. */
  height?: number;
  className?: string;
}) {
  if (!flags.iosAppStoreLive && !flags.androidPlayLive) return null;
  const h = Math.max(40, height);
  const gh = Math.round(h * 1.45);
  return (
    <div className={`flex flex-wrap items-center ${className}`} style={{ gap: Math.round(h / 4) }}>
      {flags.iosAppStoreLive ? (
        <a href={iosHref} className="inline-block" data-testid="badge-app-store">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={APP_STORE_BADGE.svg}
            alt={labels.appStore}
            height={h}
            width={Math.round(h * APP_STORE_BADGE.ratio)}
            style={{ height: h, width: "auto" }}
            loading="lazy"
          />
        </a>
      ) : null}
      {flags.androidPlayLive ? (
        <a href={androidHref} className="inline-block" data-testid="badge-google-play">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={GOOGLE_PLAY_BADGE.png}
            alt={labels.googlePlay}
            height={gh}
            width={Math.round(gh * GOOGLE_PLAY_BADGE.ratio)}
            style={{ height: gh, width: "auto", margin: `-${Math.round((gh - h) / 2)}px 0` }}
            loading="lazy"
          />
        </a>
      ) : null}
    </div>
  );
}

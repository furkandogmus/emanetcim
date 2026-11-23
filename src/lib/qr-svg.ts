import QRCode from "qrcode";

/** QR kodunu satir ici SVG olarak uretir (sunucu). Hata duzeltme `M`: basili afiste yeterli. */
export function qrSvg(text: string, opts: { margin?: number } = {}): Promise<string> {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: opts.margin ?? 1 });
}

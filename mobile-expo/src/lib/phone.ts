import { Linking } from "react-native";

/**
 * Admin ekranlarindaki arama/WhatsApp baglantilari. Numaranin uluslararasi bicimi
 * SUNUCUDA uretilir (`toWhatsAppNumber`, DTO'daki `whatsapp`); burada cevrim yok,
 * yalnizca baglanti kurulur. Cevrilemeyen numarada WhatsApp dugmesi hic cizilmez.
 */
export function telUrl(phone: string, whatsapp?: string | null): string {
  return whatsapp ? `tel:+${whatsapp}` : `tel:${phone}`;
}

export function waUrl(whatsapp: string): string {
  return `https://wa.me/${whatsapp}`;
}

export function openUrl(url: string): void {
  void Linking.openURL(url).catch(() => undefined);
}

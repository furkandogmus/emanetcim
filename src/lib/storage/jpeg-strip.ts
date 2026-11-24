/**
 * JPEG'den meta veriyi cikarir (EXIF/GPS, XMP, IPTC, yorum, MPF) -- decode ETMEDEN.
 *
 * Istemci yeniden kodlarken EXIF'i zaten atiyor (expo-image-manipulator, web canvas), ama
 * kanit fotografi baska bir istemciden ya da elle gelen dosyadan da yuklenebilir; konum
 * bilgisinin sunucuda ikinci kez silinmesi ucuz.
 *
 * Segmentler dosya boyunca gezilir: taramalar (SOS + sikistirilmis veri) arasindaki
 * APPn/COM de atilir (progresif JPEG), cikti ilk EOI'de KESILIR -- EOI'den sonraki MPF
 * ikincil goruntuleri (kendi EXIF/GPS'leriyle) ve eklenmis yuk (poliglot) gitmez.
 * Korunanlar: APP0 (JFIF), ICC profili (APP2 `ICC_PROFILE`), APP14 (Adobe) ve goruntu
 * icin gereken segmentler. Gecerli bir JPEG degilse ya da EOI yoksa `null`.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  const n = bytes.length;
  if (n < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let o = 2;
  let sawScan = false;

  while (o + 2 <= n) {
    if (bytes[o] !== 0xff) return null;
    const marker = bytes[o + 1];
    if (marker === 0xff) {
      o += 1; // dolgu
      continue;
    }
    if (marker === 0xd9) {
      if (!sawScan) return null;
      parts.push(bytes.subarray(o, o + 2));
      return concat(parts);
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) return null;
    if (o + 4 > n) return null;
    const len = (bytes[o + 2] << 8) | bytes[o + 3];
    if (len < 2 || o + 2 + len > n) return null;
    const seg = bytes.subarray(o, o + 2 + len);
    o += 2 + len;

    if (marker === 0xda) {
      // SOS basligi + sikistirilmis veri: veri icinde FF yalniz FF00 (dolgu) ya da RSTn olur.
      sawScan = true;
      let i = o;
      while (i + 1 < n) {
        if (bytes[i] === 0xff) {
          const next = bytes[i + 1];
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
            i += 2;
            continue;
          }
          if (next === 0xff) {
            i += 1;
            continue;
          }
          break;
        }
        i += 1;
      }
      if (i + 1 >= n) return null; // EOI'siz kesik dosya
      parts.push(seg, bytes.subarray(o, i));
      o = i;
      continue;
    }
    if (keepSegment(marker, seg)) parts.push(seg);
  }
  return null;
}

function keepSegment(marker: number, seg: Uint8Array): boolean {
  if (marker === 0xfe) return false; // COM
  if (marker < 0xe0 || marker > 0xef) return true; // DQT, SOF, DHT, DRI, DNL ...
  if (marker === 0xe0 || marker === 0xee) return true; // JFIF, Adobe
  if (marker === 0xe2) return String.fromCharCode(...seg.subarray(4, 15)) === "ICC_PROFILE";
  return false; // APP1 (EXIF/XMP), APP2 MPF, APP13 (IPTC), digerleri
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let w = 0;
  for (const p of parts) {
    out.set(p, w);
    w += p.length;
  }
  return out;
}

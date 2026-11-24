/**
 * JPEG'den meta veriyi cikarir (EXIF/GPS, XMP, IPTC, yorum, MPF) -- decode ETMEDEN.
 *
 * Istemci yeniden kodlarken EXIF'i zaten atiyor (expo-image-manipulator, web canvas), ama
 * kanit fotografi baska bir istemciden ya da elle gelen dosyadan da yuklenebilir; konum
 * bilgisinin sunucuda ikinci kez silinmesi ucuz. Segmentler SOS'a kadar gezilir; goruntu
 * verisi oldugu gibi kopyalanir. Korunanlar: APP0 (JFIF), ICC renk profili (APP2
 * `ICC_PROFILE`), APP14 (Adobe renk donusumu) ve goruntu icin gereken tum segmentler.
 * Baytlar gecerli bir JPEG degilse `null`.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const out: number[][] = [[0xff, 0xd8]];
  let total = 2;
  let o = 2;
  while (o + 4 <= bytes.length) {
    if (bytes[o] !== 0xff) return null;
    const marker = bytes[o + 1];
    // Dolgu baytlari (FF FF ...) atlanir.
    if (marker === 0xff) {
      o += 1;
      continue;
    }
    if (marker === 0xda) {
      // Start-of-scan: geri kalani (tarama + EOI) dokunulmadan.
      const rest = bytes.subarray(o);
      const result = new Uint8Array(total + rest.length);
      let w = 0;
      for (const chunk of out) {
        result.set(chunk, w);
        w += chunk.length;
      }
      result.set(rest, w);
      return result;
    }
    if (marker === 0xd8 || marker === 0xd9) return null;
    const len = (bytes[o + 2] << 8) | bytes[o + 3];
    if (len < 2 || o + 2 + len > bytes.length) return null;
    const seg = bytes.subarray(o, o + 2 + len);
    if (keepSegment(marker, seg)) {
      out.push(Array.from(seg));
      total += seg.length;
    }
    o += 2 + len;
  }
  return null;
}

function keepSegment(marker: number, seg: Uint8Array): boolean {
  if (marker === 0xfe) return false; // COM
  if (marker < 0xe0 || marker > 0xef) return true; // DQT, SOF, DHT, DRI ...
  if (marker === 0xe0 || marker === 0xee) return true; // JFIF, Adobe
  if (marker === 0xe2) {
    const id = String.fromCharCode(...seg.subarray(4, 15));
    return id === "ICC_PROFILE";
  }
  return false; // APP1 (EXIF/XMP), APP13 (IPTC), digerleri
}

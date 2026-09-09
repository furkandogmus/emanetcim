/// Harita altligi -- TEK KAYNAK. Web'deki `src/lib/map-style.ts` ile AYNI
/// karar, ayni saglayici: CartoDB anahtar istemeye basladi (2026-09-09'da
/// curl ile dogrulandi -- her karo "API KEY REQUIRED" filigrani donduruyordu),
/// ham `tile.openstreetmap.org` ise ticari servisleri acikca uyaran bir
/// kullanim politikasina tabi ve uygulamaya ozgu bir User-Agent sart kosuyor.
///
/// OpenFreeMap ikisinin de yerine gecer: anahtar istemez, istek siniri yok,
/// ticari kullanima acik (kaynak: https://openfreemap.org).
///
/// Web MapLibre GL JS ile native render ediyor; mobil `flutter_map` +
/// `flutter_map_vector_tiles` ile AYNI vektor stilini (`bright`) ayni
/// OpenFreeMap sunucusundan cekip cizer -- iki farkli harita degil, iki
/// farkli motorda ayni kaynak.
class MapStyle {
  MapStyle._();

  static const String styleUrl = 'https://tiles.openfreemap.org/styles/bright';

  /// Atif bir tercih degil, LISANS SARTI (ODbL). Web'deki `MAP_ATTRIBUTION`
  /// ile ayni icerik: OpenStreetMap kredisi + telif baglantisi. Harita cizen
  /// HER bilesen bunu ACIKCA gostermeli -- saglayicinin otomatik atfina
  /// guvenmek yetmez (bkz. web'deki `map-style.test.ts` mandali: 2026-08-31'de
  /// canlida bu zincir sessizce koptu ve atif kutusu bos kaldi).
  ///
  /// Basinda '©' YOK: `SimpleAttributionWidget` "flutter_map | © " onekini
  /// zaten kendisi ekliyor, buraya konursa "© ©" olarak cift basiliyordu.
  static const String attributionText =
      'OpenStreetMap katkıda bulunanlar · OpenFreeMap';

  static const String attributionUrl =
      'https://www.openstreetmap.org/copyright';
}

import 'package:freezed_annotation/freezed_annotation.dart';

part 'shop.freezed.dart';
part 'shop.g.dart';

@freezed
abstract class ShopDto with _$ShopDto {
  const factory ShopDto({
    required String id,
    required String name,
    required double pricePerDay,
    required int capacity,
    String? address,
    String? city,
    String? district,
    double? latitude,
    double? longitude,
    double? rating,
    String? openingTime,
    String? closingTime,
    @Default(false) bool open247,
    @Default(false) bool hasRestroom,
    @Default(false) bool hasCctv,
    @Default(false) bool hasClimateControl,
    @Default(false) bool acceptsLargeItems,
    @Default(true) bool isActive,
    @Default(false) bool isVerified,

    /// Talep testi noktasi: aramada gorunur ama REZERVASYON ALMAZ.
    ///
    /// Sunucu `toMobileShop` ile gonderiyor. Bayrak olmadan istemci bu noktayi
    /// normal bir dukkandan ayirt edemiyordu: sema varsayilani olan fiyati (o gun 50 TL) ve
    /// "Simdi Rezerve Et"i gosteriyor, misafir deniyor ve sunucudan
    /// `409 shop_not_open_yet` yiyordu. Sunucu kapisi saglam, ama tutamayacagimiz
    /// sozu verdikten sonra reddetmek kapinin isi degil -- arayuzun isi.
    @Default(false) bool isPrelaunch,
    double? distanceKm,
    int? bagsAvailable,
    @JsonKey(name: 'image') String? imageUrl,

    /// Yalnizca detay ucu (`/shops/:id`) gonderir; listede `null`.
    ShopPricingDto? pricing,
  }) = _ShopDto;

  factory ShopDto.fromJson(Map<String, dynamic> json) =>
      _$ShopDtoFromJson(json);
}

/// Odeme ekraninin TAHMINI tutari icin sunucu kurallari (`toMobilePricing`).
///
/// Ekran bunlari eskiden sabit yaziyordu (0.8/1.0/1.5 ve ₺15 sigorta); canlida
/// carpanlar 1/1/1 ve sigorta 0 oldugu icin misafir, kesilecek tutardan farkli
/// bir toplam goruyordu. Varsayilanlar canli satirla ayni: alan gelmezse
/// tahmin en azindan bugunku fiyatla ortusur.
@freezed
abstract class ShopPricingDto with _$ShopPricingDto {
  const factory ShopPricingDto({
    @Default(1.0) double bagMultiplierS,
    @Default(1.0) double bagMultiplierM,
    @Default(1.0) double bagMultiplierXl,
    @Default(0.0) double insuranceFeeTry,
  }) = _ShopPricingDto;

  factory ShopPricingDto.fromJson(Map<String, dynamic> json) =>
      _$ShopPricingDtoFromJson(json);
}

String shopImageUrl(ShopDto shop) {
  return shop.imageUrl ?? '';
}

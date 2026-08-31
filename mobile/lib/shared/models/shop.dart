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
  /// normal bir dukkandan ayirt edemiyordu: sema varsayilani olan 50 TL'yi ve
  /// "Simdi Rezerve Et"i gosteriyor, misafir deniyor ve sunucudan
  /// `409 shop_not_open_yet` yiyordu. Sunucu kapisi saglam, ama tutamayacagimiz
  /// sozu verdikten sonra reddetmek kapinin isi degil -- arayuzun isi.
  @Default(false) bool isPrelaunch,
  double? distanceKm,
  int? bagsAvailable,
  @JsonKey(name: 'image') String? imageUrl,
  }) = _ShopDto;

  factory ShopDto.fromJson(Map<String, dynamic> json) =>
      _$ShopDtoFromJson(json);
}

String shopImageUrl(ShopDto shop) {
  return shop.imageUrl ?? '';
}

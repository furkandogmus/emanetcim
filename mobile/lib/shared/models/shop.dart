import 'package:freezed_annotation/freezed_annotation.dart';

part 'shop.freezed.dart';
part 'shop.g.dart';

@freezed
abstract class ShopDto with _$ShopDto {
  const factory ShopDto({
    required String id,
    required String name,
    String? address,
    String? city,
    String? district,
    double? latitude,
    double? longitude,
    required double pricePerDay,
    required int capacity,
    double? rating,
    String? openingTime,
    String? closingTime,
    @Default(false) bool open247,
    @Default(false) bool hasRestroom,
    @Default(true) bool isActive,
    double? distanceKm,
    int? bagsAvailable,
  }) = _ShopDto;

  factory ShopDto.fromJson(Map<String, dynamic> json) =>
      _$ShopDtoFromJson(json);
}

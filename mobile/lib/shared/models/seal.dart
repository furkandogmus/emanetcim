import 'package:freezed_annotation/freezed_annotation.dart';

part 'seal.freezed.dart';
part 'seal.g.dart';

enum SealStatus {
  @JsonValue("STOCK")
  stock,
  @JsonValue("ASSIGNED")
  assigned,
  @JsonValue("IN_USE")
  inUse,
  @JsonValue("RETURNED")
  returned,
  @JsonValue("FAULTY")
  faulty,
}

@freezed
abstract class SealDto with _$SealDto {
  const factory SealDto({
    required int serialNumber,
    required SealStatus status,
    String? shopId,
    DateTime? assignedAt,
  }) = _SealDto;

  factory SealDto.fromJson(Map<String, dynamic> json) =>
      _$SealDtoFromJson(json);
}

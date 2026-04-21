import 'package:freezed_annotation/freezed_annotation.dart';

part 'seal.freezed.dart';
part 'seal.g.dart';

enum SealStatus { STOCK, ASSIGNED, IN_USE, RETURNED, FAULTY }

@freezed
abstract class SealDto with _$SealDto {
  const factory SealDto({
    required int serialNumber,
    required SealStatus status,
    String? shopId,
    DateTime? assignedAt,
  }) = _SealDto;

  factory SealDto.fromJson(Map<String, dynamic> json) => _$SealDtoFromJson(json);
}

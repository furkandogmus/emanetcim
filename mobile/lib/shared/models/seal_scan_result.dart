import 'package:freezed_annotation/freezed_annotation.dart';

part 'seal_scan_result.freezed.dart';
part 'seal_scan_result.g.dart';

@freezed
abstract class SealScanResult with _$SealScanResult {
  const factory SealScanResult({
    // 'type' == 'seal' yanitinda `id` alani hic gelmiyor (bkz.
    // src/app/api/mobile/seals/scan/route.ts) — `required` yapmak o akisi
    // parse hatasiyla kirar, orijinal elle yazilmis fromJson gibi bos
    // dizgeye dusuyor.
    @Default('') String type,
    @Default('') String id,
    String? bookingId,
    String? status,
    String? message,
    int? serialNumber,
  }) = _SealScanResult;

  factory SealScanResult.fromJson(Map<String, dynamic> json) =>
      _$SealScanResultFromJson(json);
}

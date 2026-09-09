import 'package:freezed_annotation/freezed_annotation.dart';

part 'mobile_device.freezed.dart';
part 'mobile_device.g.dart';

@freezed
abstract class MobileDeviceDto with _$MobileDeviceDto {
  const factory MobileDeviceDto({
    required String token,
    required String tokenSuffix,
    required String platform,
    required DateTime lastSeenAt,
    String? appVersion,
    String? locale,
  }) = _MobileDeviceDto;

  factory MobileDeviceDto.fromJson(Map<String, dynamic> json) =>
      _$MobileDeviceDtoFromJson(json);
}

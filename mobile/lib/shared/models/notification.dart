import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification.freezed.dart';
part 'notification.g.dart';

enum NotificationType {
  info,
  bookingUpdate,
  paymentSuccess,
  shopApplication,
  dispute,
  campaign
}

@freezed
abstract class NotificationDto with _$NotificationDto {
  const factory NotificationDto({
    required String id,
    required String title,
    required String body,
    required NotificationType type,
    required DateTime createdAt,
    @Default(false) bool isRead,
    String? deepLink,
    Map<String, dynamic>? data,
  }) = _NotificationDto;

  factory NotificationDto.fromJson(Map<String, dynamic> json) => _$NotificationDtoFromJson(json);
}

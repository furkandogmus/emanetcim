import 'package:freezed_annotation/freezed_annotation.dart';

part 'admin_stats.freezed.dart';
part 'admin_stats.g.dart';

@freezed
abstract class AdminStatsDto with _$AdminStatsDto {
  const factory AdminStatsDto({
    required int totalBookings,
    required double totalRevenue,
    required int totalPartners,
    required int pendingApplications,
    required int unreadMessages,
  }) = _AdminStatsDto;

  factory AdminStatsDto.fromJson(Map<String, dynamic> json) =>
      _$AdminStatsDtoFromJson(json);
}

import 'package:freezed_annotation/freezed_annotation.dart';

part 'earnings_stats.freezed.dart';
part 'earnings_stats.g.dart';

@freezed
abstract class EarningsStats with _$EarningsStats {
  const factory EarningsStats({
    @Default(0) double totalBalance,
    @Default(0) double todayEarnings,
    @Default(0) double thisWeek,
    @Default(0) double thisMonth,
    @Default(<EarningsHistoryItem>[]) List<EarningsHistoryItem> history,
    String? error,
  }) = _EarningsStats;

  factory EarningsStats.fromJson(Map<String, dynamic> json) =>
      _$EarningsStatsFromJson(json);
}

@freezed
abstract class EarningsHistoryItem with _$EarningsHistoryItem {
  const factory EarningsHistoryItem({
    required String date,
    required double amount,
    String? bookingId,
    String? status,
  }) = _EarningsHistoryItem;

  factory EarningsHistoryItem.fromJson(Map<String, dynamic> json) =>
      _$EarningsHistoryItemFromJson(json);
}

class EarningsStats {
  final double totalBalance;
  final double todayEarnings;
  final double thisWeek;
  final double thisMonth;
  final List<EarningsHistoryItem> history;
  final String? error;

  EarningsStats({
    this.totalBalance = 0,
    this.todayEarnings = 0,
    this.thisWeek = 0,
    this.thisMonth = 0,
    this.history = const [],
    this.error,
  });

  factory EarningsStats.fromJson(Map<String, dynamic> json) {
    return EarningsStats(
      totalBalance: (json['totalBalance'] as num?)?.toDouble() ?? 0,
      todayEarnings: (json['todayEarnings'] as num?)?.toDouble() ?? 0,
      thisWeek: (json['thisWeek'] as num?)?.toDouble() ?? 0,
      thisMonth: (json['thisMonth'] as num?)?.toDouble() ?? 0,
      history: (json['history'] as List<dynamic>?)
              ?.map((e) => EarningsHistoryItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  bool get hasError => error != null;
}

class EarningsHistoryItem {
  final String date;
  final double amount;
  final String? bookingId;
  final String? status;

  EarningsHistoryItem({
    required this.date,
    required this.amount,
    this.bookingId,
    this.status,
  });

  factory EarningsHistoryItem.fromJson(Map<String, dynamic> json) {
    return EarningsHistoryItem(
      date: json['date'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      bookingId: json['bookingId'] as String?,
      status: json['status'] as String?,
    );
  }
}

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

final notificationPrefsProvider =
    NotifierProvider<NotificationPrefsNotifier, NotificationPrefs>(
  NotificationPrefsNotifier.new,
);

class NotificationPrefs {
  final bool bookingUpdates;
  final bool promotions;
  final bool partnerAlerts;

  const NotificationPrefs({
    this.bookingUpdates = true,
    this.promotions = true,
    this.partnerAlerts = true,
  });

  NotificationPrefs copyWith({
    bool? bookingUpdates,
    bool? promotions,
    bool? partnerAlerts,
  }) => NotificationPrefs(
    bookingUpdates: bookingUpdates ?? this.bookingUpdates,
    promotions: promotions ?? this.promotions,
    partnerAlerts: partnerAlerts ?? this.partnerAlerts,
  );
}

class NotificationPrefsNotifier extends Notifier<NotificationPrefs> {
  @override
  NotificationPrefs build() {
    Future.microtask(_load);
    return const NotificationPrefs();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = NotificationPrefs(
      bookingUpdates: prefs.getBool('notif_booking') ?? true,
      promotions: prefs.getBool('notif_promo') ?? true,
      partnerAlerts: prefs.getBool('notif_partner') ?? true,
    );
  }

  Future<void> setBookingUpdates(bool val) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notif_booking', val);
    state = state.copyWith(bookingUpdates: val);
  }

  Future<void> setPromotions(bool val) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notif_promo', val);
    state = state.copyWith(promotions: val);
  }

  Future<void> setPartnerAlerts(bool val) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notif_partner', val);
    state = state.copyWith(partnerAlerts: val);
  }
}

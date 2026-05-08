import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Centralized analytics service — allows switching between Firebase,
/// Mixpanel, or Amplitude without changing UI code.
final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return AnalyticsService();
});

class AnalyticsService {
  Future<void> logEvent(String name, {Map<String, dynamic>? parameters}) async {
    debugPrint('Analytics Event: $name | Params: $parameters');
    // TODO: Implement Firebase Analytics or Mixpanel
  }

  Future<void> logScreenView(String screenName) async {
    debugPrint('Analytics Screen: $screenName');
    // TODO: Implement Firebase Analytics
  }

  Future<void> setUserIdentifier(String id) async {
    debugPrint('Analytics User: $id');
  }
}

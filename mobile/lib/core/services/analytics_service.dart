import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/logger_service.dart';

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return AnalyticsService();
});

class AnalyticsService {
  Future<void> logEvent(String name, {Map<String, dynamic>? parameters}) async {
    if (kDebugMode) debugPrint('📊 Analytics: $name | Params: $parameters');
    Logger.i('Analytics: $name');
  }

  Future<void> logScreenView(String screenName) async {
    if (kDebugMode) debugPrint('📱 Screen: $screenName');
    Logger.i('Screen view: $screenName');
  }

  Future<void> setUserIdentifier(String id) async {
    if (kDebugMode) debugPrint('👤 User: $id');
    Logger.i('User identified: $id');
  }
}

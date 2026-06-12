import 'dart:io' show Platform;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_review/in_app_review.dart';
import 'package:shared_preferences/shared_preferences.dart';

final reviewServiceProvider = Provider((ref) => ReviewService());

class ReviewService {
  final InAppReview _inAppReview = InAppReview.instance;

  Future<void> requestReview() async {
    final prefs = await SharedPreferences.getInstance();

    // Don't ask too often
    final lastAsk = prefs.getInt('last_review_ask') ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;

    // Wait at least 30 days between asks
    if (now - lastAsk < 30 * 24 * 60 * 60 * 1000) return;

    if (await _inAppReview.isAvailable()) {
      await _inAppReview.requestReview();
      await prefs.setInt('last_review_ask', now);
    }
  }

  Future<void> openStore() async {
    await _inAppReview.openStoreListing(
      appStoreId: Platform.isIOS ? '6470000000' : 'com.bagajpark',
      // TODO: Replace '6470000000' with real Apple App Store ID after first release
      // TODO: Add real macOS/Windows store IDs if applicable
    );
  }
}

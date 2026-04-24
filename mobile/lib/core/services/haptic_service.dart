import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final hapticServiceProvider = Provider((ref) => HapticService());

class HapticService {
  Future<void> light() async {
    await HapticFeedback.lightImpact();
  }

  Future<void> medium() async {
    await HapticFeedback.mediumImpact();
  }

  Future<void> heavy() async {
    await HapticFeedback.heavyImpact();
  }

  Future<void> success() async {
    // Success pattern
    await HapticFeedback.mediumImpact();
    await Future.delayed(const Duration(milliseconds: 50));
    await HapticFeedback.lightImpact();
  }

  Future<void> error() async {
    // Error pattern
    await HapticFeedback.heavyImpact();
    await Future.delayed(const Duration(milliseconds: 50));
    await HapticFeedback.heavyImpact();
  }

  Future<void> selection() async {
    await HapticFeedback.selectionClick();
  }
}

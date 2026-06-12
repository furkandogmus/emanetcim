import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

final biometricServiceProvider = Provider<BiometricService>((ref) {
  return BiometricService();
});

class BiometricService {
  final _auth = LocalAuthentication();
  static const _prefKey = 'biometric_enabled';
  static DateTime _lastAuth = DateTime(2000);

  Future<bool> get isAvailable async {
    try {
      if (!await _auth.isDeviceSupported()) return false;
      final biometrics = await _auth.getAvailableBiometrics();
      return biometrics.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (_) {
      return [];
    }
  }

  Future<bool> get isEnabled async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_prefKey) ?? false;
  }

  Future<void> setEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKey, enabled);
  }

  Future<bool> authenticate({
    required String reason,
  }) async {
    _lastAuth = DateTime.now();
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        biometricOnly: false,
        sensitiveTransaction: true,
      );
    } catch (e) {
      debugPrint('🔐 Biometric authenticate error: $e');
      return false;
    }
  }

  Future<bool> tryAuthenticate(String reason) async {
    if (!await isEnabled) return true;
    if (!await isAvailable) {
      await setEnabled(false);
      return true;
    }
    return authenticate(reason: reason);
  }

  static bool get shouldSkipOnResume =>
      DateTime.now().difference(_lastAuth) < const Duration(seconds: 5);
}

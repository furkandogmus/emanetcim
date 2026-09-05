import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_ce/hive.dart';

import '../api/ssl_pinning.dart';
import '../config/env.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

class TokenStore {
  static const _access = 'access_token';
  static const _refresh = 'refresh_token';
  static const _biometricSessions = 'biometric_accounts';
  static const _hiveKey = 'hive_encryption_key';

  final _storage = const FlutterSecureStorage();
  Completer<bool>? _refreshCompleter;

  Future<List<int>?> getHiveKey() async {
    final keyStr = await _storage.read(key: _hiveKey);
    if (keyStr == null) {
      final key = Hive.generateSecureKey();
      await _storage.write(key: _hiveKey, value: base64UrlEncode(key));
      return key;
    }
    return base64Url.decode(keyStr);
  }

  Future<String?> readAccessToken() => _storage.read(key: _access);
  Future<String?> readRefreshToken() => _storage.read(key: _refresh);

  Future<void> save({required String access, required String refresh}) async {
    await _storage.write(key: _access, value: access);
    await _storage.write(key: _refresh, value: refresh);
  }

  Future<void> clear() async {
    await _storage.delete(key: _access);
    await _storage.delete(key: _refresh);
  }

  Future<void> saveBiometricAccount(String email, String refreshToken) async {
    final accounts = await getBiometricAccounts();
    accounts
      ..removeWhere((a) => a['email'] == email)
      ..add({'email': email, 'refreshToken': refreshToken});
    // Keep max 5 accounts
    if (accounts.length > 5) accounts.removeAt(0);
    await _storage.write(key: _biometricSessions, value: jsonEncode(accounts));
  }

  Future<void> removeBiometricAccount(String email) async {
    final accounts = await getBiometricAccounts();
    accounts.removeWhere((a) => a['email'] == email);
    await _storage.write(key: _biometricSessions, value: jsonEncode(accounts));
  }

  Future<List<Map<String, String>>> getBiometricAccounts() async {
    final data = await _storage.read(key: _biometricSessions);
    if (data == null) return [];
    try {
      final list = jsonDecode(data) as List<dynamic>;
      return list.map((e) => Map<String, String>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<bool> refresh(Dio dio) async {
    if (_refreshCompleter != null && !_refreshCompleter!.isCompleted) {
      return _refreshCompleter!.future;
    }
    _refreshCompleter = Completer<bool>();
    try {
      final rt = await readRefreshToken();
      if (rt == null) {
        _refreshCompleter!.complete(false);
        return false;
      }
      final refreshDio = Dio(
        BaseOptions(
          baseUrl: Env.apiBaseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 20),
          contentType: 'application/json',
        ),
      );
      SslPinning.apply(refreshDio);
      final res = await refreshDio.post(
        '/auth/refresh',
        data: {'refreshToken': rt},
      );
      await save(
        access: res.data['accessToken'] as String,
        refresh: res.data['refreshToken'] as String,
      );
      _refreshCompleter!.complete(true);
      return true;
    } catch (_) {
      await clear();
      _refreshCompleter!.complete(false);
      return false;
    } finally {
      _refreshCompleter = null;
    }
  }
}

import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive/hive.dart';

import '../config/env.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

class TokenStore {
  static const _access = 'access_token';
  static const _refresh = 'refresh_token';
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
      final res = await Dio(
        BaseOptions(baseUrl: Env.apiBaseUrl),
      ).post('/auth/refresh', data: {'refreshToken': rt});
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
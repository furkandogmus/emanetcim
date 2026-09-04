import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import '../auth/token_store.dart';
import '../config/env.dart';
import 'ssl_pinning.dart';

final dioProvider = Provider<Dio>((ref) {
  final store = ref.watch(tokenStoreProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: Env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      contentType: 'application/json',
    ),
  );

  final cache = <String, _CacheEntry>{};
  const cacheTtl = Duration(minutes: 5);
  const maxCacheSize = 100;

  ref.onDispose(cache.clear);

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await store.readAccessToken();
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (err, handler) async {
        if (err.response?.statusCode == 401) {
          final options = err.requestOptions;
          if (options.headers.containsKey('X-Retry')) {
            return handler.next(err);
          }

          final ok = await store.refresh(dio);
          if (ok) {
            options.headers['X-Retry'] = '1';
            cache.clear();
            final clone = await dio.fetch(options);
            return handler.resolve(clone);
          }
        }

        final isNetworkError =
            err.type == DioExceptionType.connectionTimeout ||
            err.type == DioExceptionType.sendTimeout ||
            err.type == DioExceptionType.receiveTimeout ||
            err.type == DioExceptionType.connectionError;

        final isServerError =
            err.response != null && err.response!.statusCode! >= 500;

        if (isNetworkError || isServerError) {
          final options = err.requestOptions;
          final int retries = options.extra['retries'] ?? 0;
          if (retries < 2) {
            options.extra['retries'] = retries + 1;
            await Future.delayed(Duration(milliseconds: 1000 * (retries + 1)));
            try {
              final clone = await dio.fetch(options);
              return handler.resolve(clone);
            } catch (e) {
              return handler.next(err);
            }
          }
        }

        handler.next(err);
      },
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        options.extra['startTime'] = DateTime.now().millisecondsSinceEpoch;
        handler.next(options);
      },
      onResponse: (response, handler) {
        final startTime = response.requestOptions.extra['startTime'] as int?;
        if (startTime != null) {
          final duration = DateTime.now().millisecondsSinceEpoch - startTime;
          if (duration > 2000) {
            debugPrint(
              '⚠️ SLOW API: ${response.requestOptions.path} took ${duration}ms',
            );
          }
        }
        handler.next(response);
      },
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (options.method == 'GET') {
          if (options.headers.containsKey('X-Refresh')) {
            options.headers.remove('X-Refresh');
            return handler.next(options);
          }

          final token = await store.readAccessToken();
          if (token == null) return handler.next(options);
          final tokenHash = token.substring(token.length - 8);
          final key = '$tokenHash:${options.uri.toString()}';
          if (cache.containsKey(key)) {
            final entry = cache[key]!;
            if (DateTime.now().difference(entry.timestamp) < cacheTtl) {
              return handler.resolve(entry.response);
            } else {
              cache.remove(key);
            }
          }
        }
        handler.next(options);
      },
      onResponse: (response, handler) async {
        if (response.requestOptions.method == 'GET') {
          final token = await store.readAccessToken();
          if (token == null) return handler.next(response);
          final tokenHash = token.substring(token.length - 8);
          final key = '$tokenHash:${response.requestOptions.uri.toString()}';

          if (cache.length >= maxCacheSize) {
            final oldestKey = cache.keys.reduce(
              (a, b) =>
                  cache[a]!.timestamp.isBefore(cache[b]!.timestamp) ? a : b,
            );
            cache.remove(oldestKey);
          }

          cache[key] = _CacheEntry(
            response: response,
            timestamp: DateTime.now(),
          );
        }
        handler.next(response);
      },
    ),
  );

  if (kDebugMode) {
    dio.interceptors.add(
      PrettyDioLogger(requestBody: true, responseBody: false),
    );
  }

  SslPinning.apply(dio);

  return dio;
});

class _CacheEntry {
  final Response response;
  final DateTime timestamp;

  _CacheEntry({required this.response, required this.timestamp});
}

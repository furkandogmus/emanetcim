import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import '../auth/token_store.dart';
import '../config/env.dart';

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
          // Security: Prevent infinite retry loops
          if (options.headers.containsKey('X-Retry')) {
            return handler.next(err);
          }

          final ok = await store.refresh(dio);
          if (ok) {
            options.headers['X-Retry'] = '1';
            final clone = await dio.fetch(options);
            return handler.resolve(clone);
          }
        }

        // Automatic retry for 5xx errors or network failures (timeouts)
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
            // Exponential backoff (1s, 2s)
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

  // Performance Interceptor - track slow API calls
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        options.extra['startTime'] = DateTime.now().millisecondsSinceEpoch;
        handler.next(options);
      },
      onResponse: (response, handler) {
        final startTime = response.requestOptions.extra['startTime'] as int?;
        if (startTime != null) {
          final endTime = DateTime.now().millisecondsSinceEpoch;
          final duration = endTime - startTime;
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

  // Simple In-Memory Cache Interceptor with TTL and Size Limit
  final cache = <String, _CacheEntry>{};
  const cacheTtl = Duration(minutes: 5);
  const maxCacheSize = 100;

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (options.method == 'GET') {
          // Allow bypassing cache with a custom header
          if (options.headers.containsKey('X-Refresh')) {
            options.headers.remove('X-Refresh');
            return handler.next(options);
          }

          final token = await store.readAccessToken();
          final tokenHash = token != null ? token.substring(token.length - 8) : '';
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
          final tokenHash = token != null ? token.substring(token.length - 8) : '';
          final key = '${tokenHash}:${response.requestOptions.uri.toString()}';

          // Limit cache size - remove oldest entry if full
          if (cache.length >= maxCacheSize) {
            cache.remove(cache.keys.first);
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

  return dio;
});

class _CacheEntry {
  final Response response;
  final DateTime timestamp;

  _CacheEntry({required this.response, required this.timestamp});
}

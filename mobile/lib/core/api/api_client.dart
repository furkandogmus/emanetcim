import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
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
        handler.next(err);
      },
    ),
  );

  if (kDebugMode) {
    dio.interceptors.add(
      PrettyDioLogger(
        requestHeader: false,
        requestBody: true,
        responseBody: false,
        error: true,
        compact: true,
      ),
    );
  }

  return dio;
});

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import '../auth/token_store.dart';
import '../config/env.dart';

final dioProvider = Provider<Dio>((ref) {
  final store = ref.watch(tokenStoreProvider);
  final dio = Dio(BaseOptions(
    baseUrl: Env.apiBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
    contentType: 'application/json',
  ));

  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await store.readAccessToken();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
      handler.next(options);
    },
    onError: (err, handler) async {
      if (err.response?.statusCode == 401) {
        final ok = await store.refresh(dio);
        if (ok) {
          final clone = await dio.fetch(err.requestOptions);
          return handler.resolve(clone);
        }
      }
      handler.next(err);
    },
  ));

  dio.interceptors.add(PrettyDioLogger(
    requestHeader: false,
    requestBody: true,
    responseBody: false,
    error: true,
    compact: true,
  ));

  return dio;
});

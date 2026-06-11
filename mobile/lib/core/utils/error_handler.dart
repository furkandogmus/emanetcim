import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';

/// Hata mesajlarını hem geliştirici hem de kullanıcı için anlamlı hale getiren yardımcı fonksiyon.
String getErrorMessage(dynamic e, {String fallback = 'An error occurred'}) {
  if (kDebugMode) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data != null) {
        final dataStr = data.toString();
        if (dataStr.trim().startsWith('<') || dataStr.contains('<!DOCTYPE')) {
          return 'DEBUG: [${e.response?.statusCode}] Server returned HTML (Page not found or Crash)!';
        }
        if (dataStr.length > 150) {
          return 'DEBUG: [${e.response?.statusCode}] ${dataStr.substring(0, 150)}...';
        }
        return 'DEBUG: [${e.response?.statusCode}] $dataStr';
      }
      return 'DEBUG: [${e.response?.statusCode}] ${e.message}';
    }
    return 'DEBUG: $e';
  }

  if (e is DioException) {
    if (e.response?.statusCode == 404) {
      return 'common.error_404'.tr();
    } else if (e.type == DioExceptionType.connectionTimeout) {
      return 'common.error_timeout'.tr();
    } else if (e.response?.statusCode != null &&
        e.response!.statusCode! >= 500) {
      return 'common.error_server'.tr();
    }
  }

  return fallback;
}

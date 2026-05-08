import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Hata mesajlarını hem geliştirici hem de kullanıcı için anlamlı hale getiren yardımcı fonksiyon.
String getErrorMessage(dynamic e, {String fallback = 'Bir hata oluştu'}) {
  if (kDebugMode) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data != null) {
        final dataStr = data.toString();
        // Eğer sunucu HTML döndüyse (sayfa bulunamadı veya crash)
        if (dataStr.trim().startsWith('<') || dataStr.contains('<!DOCTYPE')) {
          return 'DEBUG: [${e.response?.statusCode}] Sunucu HTML döndürdü (Sayfa bulunamadı veya Crash)!';
        }
        // Eğer mesaj çok uzunsa ekranı kaplamasın diye keselim
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
      return 'Aradığınız veri bulunamadı (404)';
    } else if (e.type == DioExceptionType.connectionTimeout) {
      return 'İnternet bağlantısı zaman aşımına uğradı';
    } else if (e.response?.statusCode != null &&
        e.response!.statusCode! >= 500) {
      return 'Sunucu hatası oluştu';
    }
  }

  return fallback;
}

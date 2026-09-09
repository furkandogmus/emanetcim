import 'package:flutter/material.dart';

/// Centralized brand color constants.
/// Replaces 126+ hardcoded Color(0xFFF97316) instances.
///
/// Metin/yuzey tonlari (textDark, textSecondary, placeholder, bgLight,
/// border, surfaceMuted, bgCard) TEMA-DUYARLI: 267+ cagri sitesi bunlari
/// `static const` sanip dogrudan kullaniyordu, yani koyu temada arka plan
/// siyaha donerken metin rengi HALA koyu kaliyordu -- koyu uzerinde koyu,
/// okunmuyordu (2026-09-10'da gercek cihazda bulundu, screenshotlarla
/// dogrulandi: "Hello, Test", "Popular Cities", sehir isimleri gorunmuyordu).
///
/// Cozum: bu alanlari `const` yerine geçerli parlakliga (brightness) gore
/// deger dönen getter'lara cevirmek -- 267 cagri sitesindeki `AppColors.x`
/// erisimi TEK BIR KARAKTER DEGISMEDEN calismaya devam ediyor, degeri artik
/// dogru. `syncBrightness` `app.dart`'in `MaterialApp.builder`'inda her
/// build'de cagrilir (temanin gercekten cozuldugu tek yer -- `themeMode`
/// tek basina `system` iken gercek parlakligi soylemez).
abstract final class AppColors {
  static const brandOrange = Color(0xFFEA580C); // Web's main color (#ea580c)
  static const brandOrangeDark = Color(0xFFC2430A); // Web's brand-700 (#c2430a)
  static const brandOrangeLight = Color(
    0xFFF89563,
  ); // Web's brand-300 (#f89563)

  static const primary = brandOrange;
  static const secondary = brandOrangeDark;

  static Brightness _brightness = Brightness.light;

  /// `app.dart`'in `MaterialApp.builder`'indan cagrilir; asagidaki
  /// getter'lar bir sonraki build'de bu degere gore cozulur.
  static void syncBrightness(Brightness brightness) {
    _brightness = brightness;
  }

  static bool get _isDark => _brightness == Brightness.dark;

  static const _textDarkLight = Color(0xFF0F172A);
  static const _textDarkDark = Color(
    0xFFF1F5F9,
  ); // theme.dart dark textTheme ile aynı aile
  static Color get textDark => _isDark ? _textDarkDark : _textDarkLight;
  static Color get textPrimary => textDark;

  static const _textSecondaryLight = Color(0xFF1F2937); // Slate 800
  static const _textSecondaryDark = Color(0xFF94A3B8); // Slate 400
  static Color get textSecondary =>
      _isDark ? _textSecondaryDark : _textSecondaryLight;

  static const _placeholderLight = Color(0xFF334155); // Slate 700
  static const _placeholderDark = Color(0xFF64748B); // Slate 500
  static Color get placeholder =>
      _isDark ? _placeholderDark : _placeholderLight;

  static const _bgLightLight = Color(0xFFF8FAFC);
  static const _bgLightDark = Color(
    0xFF121212,
  ); // theme.dart scaffoldBackgroundColor ile aynı
  static Color get bgLight => _isDark ? _bgLightDark : _bgLightLight;

  static const _borderLight = Color(0xFFE2E8F0);
  static const _borderDark = Color(
    0xFF333333,
  ); // theme.dart dark cardTheme border ile aynı
  static Color get border => _isDark ? _borderDark : _borderLight;

  static const _surfaceMutedLight = Color(0xFFF1F5F9);
  static const _surfaceMutedDark = Color(
    0xFF2A2A2A,
  ); // theme.dart dark input fill ile aynı
  static Color get surfaceMuted =>
      _isDark ? _surfaceMutedDark : _surfaceMutedLight;

  static const success = Color(0xFF10B981);
  static const info = Color(0xFF3B82F6);

  static Color get bgCard => _isDark ? const Color(0xFF1E1E1E) : Colors.white;
}

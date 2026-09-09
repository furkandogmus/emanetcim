import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../shared/utils/app_colors.dart';

const _brandOrange = Color(0xFFEA580C); // Web's main color (#ea580c)
const _brandOrangeDark = Color(0xFFC2430A); // Web's brand-700 (#c2430a)
const _bgLight = Color(0xFFF8FAFC);
const _textDark = Color(0xFF0F172A);
// Karanlık temada nav bar / bottom sheet / dialog için "yüzey" tonu. Diğer
// karanlık yüzey renkleri (arka plan, input dolgusu, kenarlıklar) buradan
// türetilir — bkz. buildDarkTheme().
const _darkSurface = Color(0xFF1E1E1E);
// AppColors.border/.placeholder/.textSecondary DEGIL: buildLightTheme/
// buildDarkTheme her build'de KOSULSUZ ikisi de cagrilir (aktif olmayan tema
// da MaterialApp'e verilir), yani AppColors'in dinamik (o anki parlakliga
// gore) getter'i burada YANLIS deger dondurebilir -- her fonksiyon kendi
// sabit rengini kullanmali.
const _borderLight = Color(0xFFE2E8F0);
const _placeholderLight = Color(0xFF334155);
const _textSecondaryLight = Color(0xFF1F2937);

ThemeData buildLightTheme() {
  final base = ThemeData.light(useMaterial3: true);
  final colorScheme = ColorScheme.fromSeed(
    seedColor: _brandOrange,
    primary: _brandOrange,
    secondary: _brandOrangeDark,
    surface: Colors.white,
  );
  final textTheme = GoogleFonts.outfitTextTheme(base.textTheme).copyWith(
    displayLarge: GoogleFonts.outfit(
      fontSize: 32,
      fontWeight: FontWeight.w700,
      color: _textDark,
      letterSpacing: -0.5,
    ),
    headlineMedium: GoogleFonts.outfit(
      fontSize: 24,
      fontWeight: FontWeight.w600,
      color: _textDark,
      letterSpacing: -0.5,
    ),
  );

  return base.copyWith(
    colorScheme: colorScheme,
    scaffoldBackgroundColor: _bgLight,
    textTheme: textTheme,
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: AppBarTheme(
      backgroundColor: _bgLight,
      foregroundColor: _textDark,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.outfit(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: _textDark,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF5F5F4), // Warm gray (gray-100)
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: _brandOrange, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Colors.redAccent, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      hintStyle: GoogleFonts.outfit(
        color: _placeholderLight,
        fontWeight: FontWeight.w400,
      ),
      prefixIconColor: _brandOrange,
      labelStyle: GoogleFonts.outfit(
        color: _textSecondaryLight,
        fontWeight: FontWeight.w500,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: _borderLight),
      ),
      surfaceTintColor: Colors.white,
      clipBehavior: Clip.antiAlias,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: _brandOrange,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
        textStyle: GoogleFonts.outfit(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: _textDark,
        side: BorderSide(color: Colors.grey.shade200, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        textStyle: GoogleFonts.outfit(
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 72,
      elevation: 0,
      backgroundColor: Colors.white,
      indicatorColor: _brandOrange.withValues(alpha: 0.12),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected)
              ? _brandOrange
              : _textSecondaryLight,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 24,
          color: states.contains(WidgetState.selected)
              ? _brandOrange
              : _textSecondaryLight,
        ),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      side: const BorderSide(color: _borderLight),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w500),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      showDragHandle: true,
    ),
    // Yıkıcı onay/bilgi dialogları için (bkz. ConfirmDialog) card/input/bottom
    // sheet ile aynı köşe yarıçapı ve düz (elevation 0) görünüm.
    dialogTheme: DialogThemeData(
      backgroundColor: colorScheme.surface,
      surfaceTintColor: colorScheme.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
  );
}

ThemeData buildDarkTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  // Light temadaki desenin aynısı (bkz. buildLightTheme): marka rengini
  // fromSeed'in otomatik tonlamasına bırakmıyoruz. primary için
  // _brandOrangeDark yerine daha açık brandOrangeLight kullanılır — M3'ün
  // kendi karanlık şema üretiminde de primary koyu yüzeyler üzerinde
  // kontrast için açık tona kaydırılır, aynı gerekçe burada da geçerli.
  final colorScheme = ColorScheme.fromSeed(
    seedColor: _brandOrangeDark,
    brightness: Brightness.dark,
    primary: AppColors.brandOrangeLight,
    secondary: _brandOrange,
    surface: _darkSurface,
  );
  final textTheme = GoogleFonts.outfitTextTheme(base.textTheme).copyWith(
    displayLarge: GoogleFonts.outfit(
      fontSize: 32,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.5,
    ),
    headlineMedium: GoogleFonts.outfit(
      fontSize: 24,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.5,
    ),
  );

  // Karanlık "arka plan", yüzeylerden (kart/dialog/nav bar) bilinçli olarak
  // daha koyu — M3'ün elevation-overlay mantığıyla surface'i siyaha doğru
  // %40 harmanlayarak türetiyoruz; sabit bir hex yerine colorScheme.surface'e
  // bağlı kalıyor.
  final scaffoldBackground = Color.lerp(
    colorScheme.surface,
    Colors.black,
    0.4,
  )!;

  return base.copyWith(
    colorScheme: colorScheme,
    scaffoldBackgroundColor: scaffoldBackground,
    textTheme: textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: scaffoldBackground,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.outfit(
        fontSize: 18,
        fontWeight: FontWeight.w600,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      // M3'ün karanlık temada 1dp yükseklik için kullandığı standart %5
      // beyaz overlay oranıyla surface'ten türetilir (bkz. Material elevation
      // overlay tablosu).
      fillColor: Color.lerp(colorScheme.surface, Colors.white, 0.05),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: _brandOrange, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: colorScheme.outlineVariant),
      ),
      clipBehavior: Clip.antiAlias,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: _brandOrange,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
        textStyle: GoogleFonts.outfit(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.white,
        side: BorderSide(color: colorScheme.outline, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        textStyle: GoogleFonts.outfit(
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 72,
      elevation: 0,
      backgroundColor: colorScheme.surface,
      indicatorColor: _brandOrange.withValues(alpha: 0.2),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected)
              ? _brandOrange
              : Colors.grey,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 24,
          color: states.contains(WidgetState.selected)
              ? _brandOrange
              : Colors.grey,
        ),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      side: BorderSide(color: colorScheme.outline),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w500),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colorScheme.surface,
      showDragHandle: true,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: colorScheme.surface,
      surfaceTintColor: colorScheme.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
  );
}

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

const _brandOrange = Color(0xFFEA580C); // Web's main color (#ea580c)
const _brandOrangeDark = Color(0xFFC2430A); // Web's brand-700 (#c2430a)
const _bgLight = Color(0xFFF8FAFC);
const _textDark = Color(0xFF0F172A);

ThemeData buildLightTheme() {
  final base = ThemeData.light(useMaterial3: true);
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
    colorScheme: ColorScheme.fromSeed(
      seedColor: _brandOrange,
      primary: _brandOrange,
      secondary: _brandOrangeDark,
      surface: Colors.white,
    ),
    scaffoldBackgroundColor: _bgLight,
    textTheme: textTheme,
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
        color: const Color(0xFF616161),
        fontWeight: FontWeight.w400,
      ),
      prefixIconColor: _brandOrange,
      labelStyle: GoogleFonts.outfit(
        color: const Color(0xFF616161),
        fontWeight: FontWeight.w500,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: Colors.grey.shade100),
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
  );
}

ThemeData buildDarkTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    colorScheme: ColorScheme.fromSeed(
      seedColor: _brandOrangeDark,
      brightness: Brightness.dark,
    ),
    textTheme: GoogleFonts.outfitTextTheme(base.textTheme),
  );
}

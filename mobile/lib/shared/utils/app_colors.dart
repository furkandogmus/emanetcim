import 'package:flutter/material.dart';

/// Centralized brand color constants.
/// Replaces 126+ hardcoded Color(0xFFF97316) instances.
abstract final class AppColors {
  static const brandOrange = Color(0xFFEA580C); // Web's main color (#ea580c)
  static const brandOrangeDark = Color(0xFFC2430A); // Web's brand-700 (#c2430a)
  static const brandOrangeLight = Color(
    0xFFF89563,
  ); // Web's brand-300 (#f89563)

  static const primary = brandOrange;
  static const secondary = brandOrangeDark;

  static const textDark = Color(0xFF0F172A);
  static const textPrimary = textDark;
  static const textSecondary = Color(0xFF1F2937); // Slate 800
  static const placeholder = Color(0xFF334155); // Slate 700 (Daha koyu)

  static const bgLight = Color(0xFFF8FAFC);
  static const border = Color(0xFFE2E8F0);
  static const surfaceMuted = Color(0xFFF1F5F9);
  static const success = Color(0xFF10B981);
  static const info = Color(0xFF3B82F6);
  static const bgCard = Colors.white;
}

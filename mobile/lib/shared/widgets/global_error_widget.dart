import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class GlobalErrorWidget extends StatelessWidget {
  const GlobalErrorWidget({required this.details, super.key});
  final FlutterErrorDetails details;

  @override
  Widget build(BuildContext context) {
    return Material(
      child: Container(
        color: const Color(0xFFF8FAFC),
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.error_outline_rounded,
                color: Colors.redAccent,
                size: 64,
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'fatal_error.title'.tr(),
              style: GoogleFonts.outfit(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'fatal_error.desc'.tr(),
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 15,
                color: const Color(0xFF424242),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

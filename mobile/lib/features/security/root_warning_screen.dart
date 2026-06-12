import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class RootWarningScreen extends StatelessWidget {
  const RootWarningScreen({required this.onContinue, super.key});

  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.security_update_warning_rounded,
                  color: Color(0xFFF97316),
                  size: 80,
                ),
                const SizedBox(height: 32),
                Text(
                  'security.warning_title'.tr(),
                  style: GoogleFonts.outfit(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'security.warning_desc'.tr(),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    color: Colors.white70,
                    fontSize: 16,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 48),
                FilledButton(
                  onPressed: onContinue,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFF97316),
                    minimumSize: const Size(double.infinity, 56),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(
                    'security.accept_risk'.tr(),
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    'security.exit_app'.tr(),
                    style: GoogleFonts.outfit(color: Colors.white38),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

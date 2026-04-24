import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class GlobalErrorWidget extends StatelessWidget {
  const GlobalErrorWidget({super.key, required this.details});
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
              'Bir Şeyler Ters Gitti',
              style: GoogleFonts.outfit(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Beklenmedik bir hata oluştu. Ekibimiz bilgilendirildi. Lütfen uygulamayı kapatıp tekrar açmayı deneyin.',
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 15,
                color: Colors.grey.shade600,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 48),
            FilledButton.icon(
              onPressed: () {
                // In a real app, we might restart or just go back
              },
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Yenile'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF0F172A),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

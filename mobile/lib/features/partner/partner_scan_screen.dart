import 'dart:async' show unawaited;
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/repositories/seal_repository.dart';
import '../../shared/utils/app_colors.dart';

class PartnerScanScreen extends ConsumerStatefulWidget {
  const PartnerScanScreen({super.key});
  @override
  ConsumerState<PartnerScanScreen> createState() => _PartnerScanScreenState();
}

class _PartnerScanScreenState extends ConsumerState<PartnerScanScreen> {
  bool _handled = false;

  Future<void> _onDetect(BarcodeCapture cap) async {
    if (_handled) return;
    final code = cap.barcodes.firstOrNull?.rawValue;
    if (code == null) return;

    _handled = true;
    unawaited(HapticFeedback.mediumImpact());

    try {
      final repo = ref.read(sealRepositoryProvider);
      final result = await repo.scan(code);
      if (!mounted) return;

      result.when(
        onSuccess: (data) {
          if (data['type'] == 'booking') {
            context.push('/partner/booking/${data['id']}');
          } else if (data['type'] == 'seal') {
            _showSealInfo(data);
          }
        },
        onFailure: (msg) {
          unawaited(HapticFeedback.vibrate());
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${'common.error'.tr()}: $msg')),
          );
          _handled = false;
        },
      );
    } catch (e) {
      if (!mounted) return;
      _handled = false;
    }
  }

  void _showSealInfo(Map<String, dynamic> data) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'partner.seal_info'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _infoRow('Serial:', '${data['serialNumber']}'),
            const SizedBox(height: 8),
            _infoRow('Status:', '${data['status']}'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'common.confirm'.tr(),
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold,
                color: AppColors.brandOrange,
              ),
            ),
          ),
        ],
      ),
    ).then((_) => _handled = false);
  }

  Widget _infoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.outfit(color: Colors.grey.shade600)),
        Text(value, style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          MobileScanner(onDetect: _onDetect),
          // Custom Overlay using CustomPaint instead of ShapeBorder
          CustomPaint(
            painter: ScannerOverlayPainter(
              borderColor: AppColors.brandOrange,
              borderRadius: 20,
              borderLength: 30,
              borderWidth: 8,
              cutOutSize: MediaQuery.of(context).size.width * 0.7,
            ),
            child: const SizedBox.expand(),
          ),
          // Back Button & UI
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        icon: const Icon(
                          Icons.arrow_back_ios_new_rounded,
                          color: Colors.white,
                        ),
                        onPressed: () => Navigator.pop(context),
                      ),
                      Text(
                        'nav.scan'.tr(),
                        style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 48), // Spacer
                    ],
                  ),
                  const Spacer(),
                  Text(
                    'partner.scan_hint'.tr(),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      color: Colors.white70,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 60),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ScannerOverlayPainter extends CustomPainter {
  final Color borderColor;
  final double borderWidth;
  final double borderRadius;
  final double borderLength;
  final double cutOutSize;

  ScannerOverlayPainter({
    required this.borderColor,
    required this.borderWidth,
    required this.borderRadius,
    required this.borderLength,
    required this.cutOutSize,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final backgroundPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.5)
      ..style = PaintingStyle.fill;

    final cutOutRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: cutOutSize,
      height: cutOutSize,
    );

    // Draw background with hole
    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height)),
        Path()..addRRect(
          RRect.fromRectAndRadius(cutOutRect, Radius.circular(borderRadius)),
        ),
      ),
      backgroundPaint,
    );

    final borderPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth
      ..strokeCap = StrokeCap.round;

    final path = Path()
      // Top left
      ..moveTo(cutOutRect.left, cutOutRect.top + borderLength)
      ..lineTo(cutOutRect.left, cutOutRect.top + borderRadius)
      ..arcToPoint(
        Offset(cutOutRect.left + borderRadius, cutOutRect.top),
        radius: Radius.circular(borderRadius),
      )
      ..lineTo(cutOutRect.left + borderLength, cutOutRect.top)
      // Top right
      ..moveTo(cutOutRect.right - borderLength, cutOutRect.top)
      ..lineTo(cutOutRect.right - borderRadius, cutOutRect.top)
      ..arcToPoint(
        Offset(cutOutRect.right, cutOutRect.top + borderRadius),
        radius: Radius.circular(borderRadius),
      )
      ..lineTo(cutOutRect.right, cutOutRect.top + borderLength)
      // Bottom left
      ..moveTo(cutOutRect.left, cutOutRect.bottom - borderLength)
      ..lineTo(cutOutRect.left, cutOutRect.bottom - borderRadius)
      ..arcToPoint(
        Offset(cutOutRect.left + borderRadius, cutOutRect.bottom),
        radius: Radius.circular(borderRadius),
      )
      ..lineTo(cutOutRect.left + borderLength, cutOutRect.bottom)
      // Bottom right
      ..moveTo(cutOutRect.right - borderLength, cutOutRect.bottom)
      ..lineTo(cutOutRect.right - borderRadius, cutOutRect.bottom)
      ..arcToPoint(
        Offset(cutOutRect.right, cutOutRect.bottom - borderRadius),
        radius: Radius.circular(borderRadius),
      )
      ..lineTo(cutOutRect.right, cutOutRect.bottom - borderLength);

    canvas.drawPath(path, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

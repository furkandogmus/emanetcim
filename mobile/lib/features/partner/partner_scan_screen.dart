import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/api/api_client.dart';

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
    HapticFeedback.mediumImpact();

    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post('/seals/scan', data: {'code': code});
      if (!mounted) return;

      final data = res.data as Map<String, dynamic>;
      if (data['type'] == 'booking') {
        context.push('/partner/booking/${data['id']}');
      } else if (data['type'] == 'seal') {
        _showSealInfo(data);
      }
    } catch (e) {
      if (!mounted) return;
      HapticFeedback.vibrate();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('common.error'.tr() + ': $e')));
      _handled = false;
    }
  }

  void _showSealInfo(Map<String, dynamic> data) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('partner.seal_info'.tr(), style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
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
            child: Text('common.confirm'.tr(), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFFF97316))),
          )
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
          // Custom Overlay
          Container(
            decoration: ShapeDecoration(
              shape: QrScannerOverlayShape(
                borderColor: const Color(0xFFF97316),
                borderRadius: 20,
                borderLength: 30,
                borderWidth: 10,
                cutOutSize: MediaQuery.of(context).size.width * 0.7,
              ),
            ),
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
                        icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
                        onPressed: () => Navigator.pop(context),
                      ),
                      Text(
                        'nav.scan'.tr(),
                        style: GoogleFonts.outfit(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(width: 48), // Spacer
                    ],
                  ),
                  const Spacer(),
                  Text(
                    'partner.scan_hint'.tr(),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(color: Colors.white70, fontSize: 14),
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

// Simple helper for QR overlay (If not available in package, we can define one)
class QrScannerOverlayShape extends ShapeBorder {
  final Color borderColor;
  final double borderWidth;
  final double borderRadius;
  final double borderLength;
  final double cutOutSize;

  const QrScannerOverlayShape({
    this.borderColor = Colors.white,
    this.borderWidth = 10,
    this.borderRadius = 0,
    this.borderLength = 40,
    this.cutOutSize = 250,
  });

  @override
  EdgeInsetsGeometry get dimensions => const EdgeInsets.all(10);

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) => Path();

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) => Path();

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {
    final width = rect.width;
    final height = rect.height;
    final borderOffset = borderWidth / 2;
    final double _borderRadius = borderRadius;
    final double _borderLength = borderLength;
    final double _cutOutSize = cutOutSize;

    final backgroundPaint = Paint()
      ..color = Colors.black.withOpacity(0.5)
      ..style = PaintingStyle.fill;

    final cutOutRect = Rect.fromCenter(
      center: Offset(width / 2, height / 2),
      width: _cutOutSize,
      height: _cutOutSize,
    );

    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(rect),
        Path()..addRRect(RRect.fromRectAndRadius(cutOutRect, Radius.circular(_borderRadius))),
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
      ..moveTo(cutOutRect.left, cutOutRect.top + _borderLength)
      ..lineTo(cutOutRect.left, cutOutRect.top + _borderRadius)
      ..arcToPoint(Offset(cutOutRect.left + _borderRadius, cutOutRect.top), radius: Radius.circular(_borderRadius))
      ..lineTo(cutOutRect.left + _borderLength, cutOutRect.top)
      // Top right
      ..moveTo(cutOutRect.right - _borderLength, cutOutRect.top)
      ..lineTo(cutOutRect.right - _borderRadius, cutOutRect.top)
      ..arcToPoint(Offset(cutOutRect.right, cutOutRect.top + _borderRadius), radius: Radius.circular(_borderRadius))
      ..lineTo(cutOutRect.right, cutOutRect.top + _borderLength)
      // Bottom left
      ..moveTo(cutOutRect.left, cutOutRect.bottom - _borderLength)
      ..lineTo(cutOutRect.left, cutOutRect.bottom - _borderRadius)
      ..arcToPoint(Offset(cutOutRect.left + _borderRadius, cutOutRect.bottom), radius: Radius.circular(_borderRadius))
      ..lineTo(cutOutRect.left + _borderLength, cutOutRect.bottom)
      // Bottom right
      ..moveTo(cutOutRect.right - _borderLength, cutOutRect.bottom)
      ..lineTo(cutOutRect.right - _borderRadius, cutOutRect.bottom)
      ..arcToPoint(Offset(cutOutRect.right, cutOutRect.bottom - _borderRadius), radius: Radius.circular(_borderRadius))
      ..lineTo(cutOutRect.right, cutOutRect.bottom - _borderLength);

    canvas.drawPath(path, borderPaint);
  }

  @override
  ShapeBorder scale(double t) => QrScannerOverlayShape(
        borderColor: borderColor,
        borderWidth: borderWidth,
        borderRadius: borderRadius,
        borderLength: borderLength,
        cutOutSize: cutOutSize,
      );
}

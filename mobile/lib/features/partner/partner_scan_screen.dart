import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post('/seals/scan', data: {'code': code});
      if (!mounted) return;

      final data = res.data as Map<String, dynamic>;
      if (data['type'] == 'booking') {
        context.push('/partner/booking/${data['id']}');
      } else if (data['type'] == 'seal') {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Mühür Bilgisi'),
            content: Text('Seri: ${data['serialNumber']}\nDurum: ${data['status']}'),
            actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Tamam'))],
          ),
        ).then((_) => _handled = false);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      _handled = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('QR Tara')),
      body: MobileScanner(onDetect: _onDetect),
    );
  }
}

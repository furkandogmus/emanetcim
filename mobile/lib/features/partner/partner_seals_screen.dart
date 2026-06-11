import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../shared/utils/app_colors.dart';

class PartnerSealsScreen extends ConsumerStatefulWidget {
  const PartnerSealsScreen({super.key});

  @override
  ConsumerState<PartnerSealsScreen> createState() => _PartnerSealsScreenState();
}

class _PartnerSealsScreenState extends ConsumerState<PartnerSealsScreen> {
  final _requestFormKey = GlobalKey<FormState>();
  final _faultyFormKey = GlobalKey<FormState>();
  final _countController = TextEditingController(text: '10');
  final _serialController = TextEditingController();
  
  int _currentSealCount = 0;
  bool _loadingShop = true;
  bool _requesting = false;
  bool _reporting = false;

  @override
  void initState() {
    super.initState();
    _fetchShopInfo();
  }

  Future<void> _fetchShopInfo() async {
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get('/partner/shop');
      final sealCount = res.data['sealCount'] as int? ?? 0;
      if (mounted) {
        setState(() {
          _currentSealCount = sealCount;
          _loadingShop = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loadingShop = false);
      }
    }
  }

  Future<void> _requestSeals() async {
    if (!_requestFormKey.currentState!.validate()) return;

    setState(() => _requesting = true);
    try {
      final dio = ref.read(dioProvider);
      final count = int.tryParse(_countController.text) ?? 10;
      await dio.post('/partner/seals/request', data: {'count': count});

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('partner.request_success'.tr())),
        );
        _countController.text = '10';
        await _fetchShopInfo();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('common.error'.tr())),
        );
      }
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  Future<void> _reportFaultySeal() async {
    if (!_faultyFormKey.currentState!.validate()) return;

    setState(() => _reporting = true);
    try {
      final dio = ref.read(dioProvider);
      final serial = int.tryParse(_serialController.text.trim());
      await dio.post('/partner/seals/report-faulty', data: {'serialNumber': serial});

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('partner.report_faulty_success'.tr())),
        );
        _serialController.clear();
        await _fetchShopInfo();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('common.error'.tr())),
        );
      }
    } finally {
      if (mounted) setState(() => _reporting = false);
    }
  }

  @override
  void dispose() {
    _countController.dispose();
    _serialController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'partner.seals_management'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
      ),
      body: _loadingShop
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Active Seal Count Card
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.brandOrange, AppColors.brandOrangeDark],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.brandOrange.withValues(alpha: 0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.verified_user_rounded,
                          color: Colors.white,
                          size: 48,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '$_currentSealCount',
                          style: GoogleFonts.outfit(
                            fontSize: 48,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        Text(
                          'booking.seals'.tr(),
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            color: Colors.white70,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Request Seals Card
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Form(
                        key: _requestFormKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'partner.request_seals'.tr(),
                              style: GoogleFonts.outfit(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 16),
                            TextFormField(
                              controller: _countController,
                              decoration: InputDecoration(
                                labelText: 'partner.request_count'.tr(),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              keyboardType: TextInputType.number,
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) {
                                  return 'partner.required'.tr();
                                }
                                final val = int.tryParse(v);
                                if (val == null || val < 1 || val > 100) {
                                  return '1 - 100';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),
                            FilledButton.icon(
                              onPressed: _requesting ? null : _requestSeals,
                              icon: _requesting
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.add_shopping_cart_rounded),
                              label: Text('partner.request_seals'.tr()),
                              style: FilledButton.styleFrom(
                                minimumSize: const Size(double.infinity, 50),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Report Faulty Seal Card
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Form(
                        key: _faultyFormKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'partner.report_faulty_seal'.tr(),
                              style: GoogleFonts.outfit(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.redAccent,
                              ),
                            ),
                            const SizedBox(height: 16),
                            TextFormField(
                              controller: _serialController,
                              decoration: InputDecoration(
                                labelText: 'partner.serial_number_label'.tr(),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              keyboardType: TextInputType.number,
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) {
                                  return 'partner.required'.tr();
                                }
                                if (int.tryParse(v) == null) {
                                  return 'partner.required'.tr();
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),
                            FilledButton.icon(
                              onPressed: _reporting ? null : _reportFaultySeal,
                              icon: _reporting
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.report_problem_rounded),
                              label: Text('partner.report_faulty_seal'.tr()),
                              style: FilledButton.styleFrom(
                                backgroundColor: Colors.redAccent,
                                minimumSize: const Size(double.infinity, 50),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

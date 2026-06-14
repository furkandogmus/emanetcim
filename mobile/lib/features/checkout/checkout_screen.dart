import 'dart:async' show unawaited;
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../core/repositories/shop_repository.dart';
import '../../core/services/haptic_service.dart';
import '../../core/services/review_service.dart';
import '../../shared/utils/app_colors.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({required this.shopId, super.key});
  final String shopId;
  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  DateTime _checkIn = DateTime.now().add(const Duration(hours: 1));
  DateTime _checkOut = DateTime.now().add(const Duration(hours: 4));
  int _s = 0;
  int _m = 1;
  int _xl = 0;
  final _coupon = TextEditingController();
  bool _busy = false;
  double _grandTotal = 0;

  @override
  void dispose() {
    _coupon.dispose();
    super.dispose();
  }

  int get _total => _s + _m + _xl;

  Future<void> _pickDate(bool isCheckIn) async {
    unawaited(ref.read(hapticServiceProvider).selection());
    final init = isCheckIn ? _checkIn : _checkOut;
    final d = await showDatePicker(
      context: context,
      initialDate: init,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 90)),
    );
    if (d == null) return;
    if (!mounted) return;
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(init),
    );
    if (t == null) return;
    setState(() {
      final dt = DateTime(d.year, d.month, d.day, t.hour, t.minute);
      final now = DateTime.now();

      if (dt.isBefore(now)) {
        _toast('checkout.error_past_time'.tr());
        return;
      }

      if (isCheckIn) {
        if (dt.isAfter(_checkOut)) {
          _checkOut = dt.add(const Duration(hours: 2));
        }
        _checkIn = dt;
      } else {
        if (dt.isBefore(_checkIn)) {
          _toast('checkout.error_checkout_before_checkin'.tr());
          return;
        }
        _checkOut = dt;
      }
    });
  }

  Future<void> _pay() async {
    if (_total == 0) return;
    unawaited(ref.read(hapticServiceProvider).medium());
    setState(() => _busy = true);
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post(
        '/checkout/intent',
        data: {
          'shopId': widget.shopId,
          'checkInTime': _checkIn.toUtc().toIso8601String(),
          'checkOutTime': _checkOut.toUtc().toIso8601String(),
          'bagCountS': _s,
          'bagCountM': _m,
          'bagCountXl': _xl,
          'couponCode': _coupon.text.trim(),
        },
      );
      final bookingId = res.data['bookingId'] as String?;
      final serverTotal = res.data['totalPrice'] as num?;

      if (bookingId == null) {
        _toast('common.error'.tr());
        return;
      }

      // Sunucu fiyatı ile tutarsızlık uyarısı
      if (serverTotal != null && _grandTotal > 0) {
        final server = serverTotal.toDouble();
        final diff = (_grandTotal - server).abs();
        if (diff > 1) {
          debugPrint('⚠️ Price mismatch: client=$_grandTotal server=$server');
          _grandTotal = server; // Sunucu fiyatı esas alınır
        }
      }

      if (!mounted) return;
      unawaited(ref.read(hapticServiceProvider).success());
      unawaited(ref.read(reviewServiceProvider).requestReview());
      context.go('/booking/$bookingId');
    } catch (e) {
      if (!mounted) return;
      var msg = 'common.error'.tr();
      if (e is DioException) {
        final errCode = e.response?.data['error'];
        if (errCode == 'no_bags') msg = 'checkout.error_no_bags'.tr();
        if (errCode == 'shop_not_found') {
          msg = 'checkout.error_shop_closed'.tr();
        }
      }
      _toast(msg);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showBagSizeGuide(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'checkout.bags_title'.tr(),
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 20),
              _bagSizeRow(
                Icons.backpack_outlined,
                'checkout.bag_s'.tr(),
                '40×30×20 cm · Sırt Çantası / Kabin',
                '0–7 kg',
              ),
              const Divider(height: 24),
              _bagSizeRow(
                Icons.luggage_outlined,
                'checkout.bag_m'.tr(),
                '65×45×25 cm · Standart Bavul',
                '7–15 kg',
              ),
              const Divider(height: 24),
              _bagSizeRow(
                Icons.work_outline_rounded,
                'checkout.bag_xl'.tr(),
                '80×50×30 cm · Büyük Bavul / Spor',
                '15–32 kg',
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bagSizeRow(IconData icon, String label, String dims, String weight) {
    return Row(
      children: [
        Icon(icon, size: 32, color: AppColors.brandOrange),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.outfit(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                dims,
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  color: const Color(0xFF616161),
                ),
              ),
              Text(
                weight,
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        backgroundColor: Colors.redAccent,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final shopAsync = ref.watch(shopProvider(widget.shopId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'checkout.title'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Date Picker Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 20,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  _dateRow(
                    'checkout.check_in'.tr(),
                    _checkIn,
                    () => _pickDate(true),
                    Icons.login_rounded,
                    Colors.green,
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Divider(height: 1),
                  ),
                  _dateRow(
                    'checkout.check_out'.tr(),
                    _checkOut,
                    () => _pickDate(false),
                    Icons.logout_rounded,
                    Colors.redAccent,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),
            Row(
              children: [
                Text(
                  'checkout.bags_title'.tr().toUpperCase(),
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF616161),
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: () => _showBagSizeGuide(context),
                  child: Icon(
                    Icons.help_outline_rounded,
                    size: 16,
                    color: Colors.grey.shade400,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            _bagCounter(
              'checkout.bag_s'.tr(),
              'checkout.bag_s_hint'.tr(),
              _s,
              (v) => setState(() => _s = v),
              Icons.backpack_outlined,
            ),
            _bagCounter(
              'checkout.bag_m'.tr(),
              'checkout.bag_m_hint'.tr(),
              _m,
              (v) => setState(() => _m = v),
              Icons.luggage_outlined,
            ),
            _bagCounter(
              'checkout.bag_xl'.tr(),
              'checkout.bag_xl_hint'.tr(),
              _xl,
              (v) => setState(() => _xl = v),
              Icons.work_outline_rounded,
            ),

            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: TextField(
                controller: _coupon,
                decoration: InputDecoration(
                  hintText: 'checkout.coupon_placeholder'.tr(),
                  border: InputBorder.none,
                  prefixIcon: const Icon(Icons.local_offer_outlined, size: 20),
                ),
                style: GoogleFonts.outfit(fontSize: 14),
              ),
            ),

            const SizedBox(height: 40),

            // Payment Summary
            shopAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Text('common.error'.tr()),
              data: (shop) {
                final ms = _checkOut.millisecondsSinceEpoch - _checkIn.millisecondsSinceEpoch;
                final days = ms <= 0 ? 1 : (ms / (24 * 60 * 60 * 1000)).ceil().clamp(1, 30);
                // BagajPark fiyatlandırması sunucu tarafında hesaplanır.
                // Buradaki hesaplama yalnızca tahmini gösterim içindir.
                // Kesin fiyat onay anında sunucudan alınır.
                final bagTotal =
                    (_s * 0.8 + _m * 1.0 + _xl * 1.5) * shop.pricePerDay * days;
                const insuranceFee = 15.0;
                _grandTotal = bagTotal > 0 ? bagTotal + insuranceFee : 0.0;
                final grandTotal = _grandTotal;

                return Container(
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(
                    color: AppColors.textDark,
                    borderRadius: BorderRadius.circular(32),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.textDark.withValues(alpha: 0.2),
                        blurRadius: 30,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      _summaryRow(
                        'checkout.summary_bags'.tr(args: [days.toString()]),
                        '₺${bagTotal.toStringAsFixed(2)}',
                      ),
                      const SizedBox(height: 16),
                      _summaryRow(
                        'checkout.insurance_fee'.tr(),
                        '₺${insuranceFee.toStringAsFixed(2)}',
                      ),
                      const SizedBox(height: 16),
                      _summaryRow(
                        'checkout.service_fee'.tr(),
                        'checkout.included'.tr(),
                        valueColor: const Color(0xFF10B981),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Divider(color: Colors.white12, height: 1),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'checkout.total'.tr().toUpperCase(),
                                style: GoogleFonts.outfit(
                                  color: Colors.white.withValues(alpha: 0.6),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              Text(
                                '₺${grandTotal.toStringAsFixed(2)}',
                                style: GoogleFonts.outfit(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 32,
                                ),
                              ),
                              Text(
                                'checkout.estimated'.tr(),
                                style: GoogleFonts.outfit(
                                  color: Colors.white.withValues(alpha: 0.4),
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.brandOrange.withValues(
                                alpha: 0.1,
                              ),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              'BAGAJPARK',
                              style: GoogleFonts.outfit(
                                color: AppColors.brandOrange,
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 32),
                      Semantics(
                        label: 'Ödemeyi Yap',
                        child: FilledButton(
                        onPressed: _busy || _total == 0 ? null : _pay,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.brandOrange,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(double.infinity, 64),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                          elevation: 0,
                        ),
                        child: _busy
                            ? const SizedBox(
                                height: 24,
                                width: 24,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.security_rounded, size: 22),
                                  const SizedBox(width: 12),
                                  Text(
                                    'checkout.pay_button'.tr(),
                                    style: GoogleFonts.outfit(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _dateRow(
    String label,
    DateTime dt,
    VoidCallback onTap,
    IconData icon,
    Color iconColor,
  ) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: const Color(0xFF616161),
                  ),
                ),
                Text(
                  DateFormat('dd MMMM, HH:mm').format(dt),
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textDark,
                  ),
                ),
              ],
            ),
            const Spacer(),
            Icon(
              Icons.calendar_month_rounded,
              size: 20,
              color: Colors.grey.shade300,
            ),
          ],
        ),
      ),
    );
  }

  Widget _bagCounter(
    String label,
    String subtitle,
    int value,
    ValueChanged<int> onChanged,
    IconData icon,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: value > 0
              ? AppColors.brandOrange.withValues(alpha: 0.3)
              : Colors.grey.shade100,
        ),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            color: value > 0 ? AppColors.brandOrange : const Color(0xFF757575),
            size: 28,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.bold,
                    color: AppColors.textDark,
                  ),
                ),
                Text(
                  subtitle,
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    color: const Color(0xFF616161),
                  ),
                ),
              ],
            ),
          ),
          Row(
            children: [
              _counterBtn(
                Icons.remove,
                () => onChanged((value - 1).clamp(0, 20)),
              ),
              SizedBox(
                width: 40,
                child: Text(
                  '$value',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              _counterBtn(Icons.add, () => onChanged((value + 1).clamp(0, 20))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _counterBtn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: () {
        unawaited(ref.read(hapticServiceProvider).selection());
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 18, color: AppColors.textDark),
      ),
    );
  }

  Widget _summaryRow(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(
            color: const Color(0xFF757575),
            fontSize: 14,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.outfit(
            color: valueColor ?? Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
      ],
    );
  }
}

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../shared/models/shop.dart';
import '../../shared/utils/app_colors.dart';

class PartnerSettingsScreen extends ConsumerStatefulWidget {
  const PartnerSettingsScreen({super.key});

  @override
  ConsumerState<PartnerSettingsScreen> createState() =>
      _PartnerSettingsScreenState();
}

class _PartnerSettingsScreenState extends ConsumerState<PartnerSettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _busy = false;
  bool _loading = true;
  int _sealCount = 0;

  late TextEditingController _name;
  late TextEditingController _capacity;
  late TextEditingController _price;
  late TextEditingController _opening;
  late TextEditingController _closing;
  late TextEditingController _address;
  late TextEditingController _city;
  late TextEditingController _district;
  late TextEditingController _phone;

  @override
  void initState() {
    super.initState();
    _fetchShop();
  }

  @override
  void dispose() {
    try {
      _name.dispose();
      _capacity.dispose();
      _price.dispose();
      _opening.dispose();
      _closing.dispose();
      _address.dispose();
      _city.dispose();
      _district.dispose();
      _phone.dispose();
    } catch (_) {}
    super.dispose();
  }

  Future<void> _fetchShop() async {
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get('/partner/shop');
      final shop = ShopDto.fromJson(res.data as Map<String, dynamic>);
      final sealCount = res.data['sealCount'] as int? ?? 0;
      setState(() {
        _name = TextEditingController(text: shop.name);
        _capacity = TextEditingController(text: shop.capacity.toString());
        _price = TextEditingController(text: shop.pricePerDay.toString());
        _opening = TextEditingController(text: shop.openingTime ?? '09:00');
        _closing = TextEditingController(text: shop.closingTime ?? '20:00');
        _address = TextEditingController(text: shop.address ?? '');
        _city = TextEditingController(text: shop.city ?? '');
        _district = TextEditingController(text: shop.district ?? '');
        _phone = TextEditingController(text: (res.data['phone'] ?? res.data['phoneNumber'] ?? '') as String);
        _sealCount = sealCount;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('${'common.error'.tr()}: $e')));
      }
    }
  }

  String? _normalizePhone(String phone) {
    if (phone.trim().isEmpty) return null;
    var d = phone.replaceAll(RegExp(r'\D'), '');
    if (d.startsWith('90') && d.length >= 12) {
      d = d.substring(2);
    }
    if (d.startsWith('0') && d.length == 11) {
      d = d.substring(1);
    }
    if (d.length == 10 && d.startsWith('5')) {
      return d;
    }
    return null;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final dio = ref.read(dioProvider);

      if (_phone.text.isNotEmpty) {
        final norm = _normalizePhone(_phone.text);
        if (norm == null) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('auth.invalid_identity'.tr())),
            );
          }
          setState(() => _busy = false);
          return;
        }
        await dio.put('/partner/phone', data: {'phone': norm});
      }

      await dio.put(
        '/partner/shop',
        data: {
          'name': _name.text,
          'capacity': int.parse(_capacity.text),
          'pricePerDay': double.parse(_price.text),
          'openingTime': _opening.text,
          'closingTime': _closing.text,
          'address': _address.text,
          'city': _city.text,
          'district': _district.text,
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('partner.settings_updated'.tr())),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('${'common.error'.tr()}: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        title: Text(
          'partner.settings'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        actions: [
          if (_busy)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            IconButton(
              onPressed: _save,
              icon: const Icon(
                Icons.check_circle_outline_rounded,
                color: Colors.green,
                size: 28,
              ),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _sectionHeader('partner.seals_management'.tr()),
              GestureDetector(
                onTap: () => context.push('/partner/seals'),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(
                          Icons.shield_rounded,
                          color: AppColors.brandOrange,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'partner.seals_management'.tr(),
                              style: GoogleFonts.outfit(
                                fontSize: 14,
                                color: const Color(0xFF424242),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '$_sealCount Adet',
                              style: GoogleFonts.outfit(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textDark,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 16,
                        color: Colors.grey.shade400,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              _sectionHeader('partner.shop_details'.tr()),
              _inputField('partner.shop_name'.tr(), _name, Icons.store_rounded),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _inputField(
                      'partner.capacity'.tr(),
                      _capacity,
                      Icons.luggage_rounded,
                      isNumber: true,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _inputField(
                      'partner.daily_price'.tr(),
                      _price,
                      Icons.payments_rounded,
                      isNumber: true,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              _sectionHeader('partner.working_hours'.tr()),
              Row(
                children: [
                  Expanded(
                    child: _inputField(
                      'partner.opening'.tr(),
                      _opening,
                      Icons.access_time_rounded,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _inputField(
                      'partner.closing'.tr(),
                      _closing,
                      Icons.access_time_filled_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              _sectionHeader('partner.address'.tr()),
              _inputField('partner.address'.tr(), _address, Icons.location_on_rounded),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _inputField(
                      'partner.city'.tr(),
                      _city,
                      Icons.location_city_rounded,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _inputField(
                      'partner.district'.tr(),
                      _district,
                      Icons.map_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _inputField('partner.phone'.tr(), _phone, Icons.phone_rounded),
              const SizedBox(height: 48),
              FilledButton(
                onPressed: _busy ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.textDark,
                  minimumSize: const Size(double.infinity, 60),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
                child: Text(
                  'common.save'.tr(),
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, left: 4),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.outfit(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          color: AppColors.textDark,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _inputField(
    String label,
    TextEditingController controller,
    IconData icon, {
    bool isNumber = false,
  }) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
          ),
        ],
      ),
      child: TextFormField(
        controller: controller,
        keyboardType: isNumber ? TextInputType.number : TextInputType.text,
        style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, size: 20),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: BorderSide.none,
          ),
          filled: true,
          fillColor: Colors.transparent,
        ),
        validator: (v) => v == null || v.isEmpty ? 'Gerekli' : null,
      ),
    );
  }
}

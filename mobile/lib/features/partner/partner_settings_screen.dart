import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../shared/models/shop.dart';
import '../../core/auth/auth_controller.dart';

class PartnerSettingsScreen extends ConsumerStatefulWidget {
  const PartnerSettingsScreen({super.key});

  @override
  ConsumerState<PartnerSettingsScreen> createState() => _PartnerSettingsScreenState();
}

class _PartnerSettingsScreenState extends ConsumerState<PartnerSettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  ShopDto? _shop;
  bool _busy = false;
  bool _loading = true;

  late TextEditingController _name;
  late TextEditingController _capacity;
  late TextEditingController _price;
  late TextEditingController _opening;
  late TextEditingController _closing;

  @override
  void initState() {
    super.initState();
    _fetchShop();
  }

  Future<void> _fetchShop() async {
    try {
      final dio = ref.read(dioProvider);
      final userId = ref.read(authControllerProvider).session?.id;
      final res = await dio.get('/partner/shop');
      final shop = ShopDto.fromJson(res.data as Map<String, dynamic>);
      setState(() {
        _shop = shop;
        _name = TextEditingController(text: shop.name);
        _capacity = TextEditingController(text: shop.capacity.toString());
        _price = TextEditingController(text: shop.pricePerDay.toString());
        _opening = TextEditingController(text: shop.openingTime ?? '09:00');
        _closing = TextEditingController(text: shop.closingTime ?? '20:00');
        _loading = false;
      });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.put('/partner/shop', data: {
        'name': _name.text,
        'capacity': int.parse(_capacity.text),
        'pricePerDay': double.parse(_price.text),
        'openingTime': _opening.text,
        'closingTime': _closing.text,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ayarlar başarıyla güncellendi.')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('partner.settings'.tr(), style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        actions: [
          if (_busy)
            const Padding(padding: EdgeInsets.all(16), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
          else
            IconButton(onPressed: _save, icon: const Icon(Icons.check_circle_outline_rounded, color: Colors.green, size: 28)),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _sectionHeader('partner.shop_details'.tr()),
              _inputField('partner.shop_name'.tr(), _name, Icons.store_rounded),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _inputField('partner.capacity'.tr(), _capacity, Icons.luggage_rounded, isNumber: true)),
                  const SizedBox(width: 16),
                  Expanded(child: _inputField('partner.daily_price'.tr(), _price, Icons.payments_rounded, isNumber: true)),
                ],
              ),
              const SizedBox(height: 32),
              _sectionHeader('partner.working_hours'.tr()),
              Row(
                children: [
                  Expanded(child: _inputField('partner.opening'.tr(), _opening, Icons.access_time_rounded)),
                  const SizedBox(width: 16),
                  Expanded(child: _inputField('partner.closing'.tr(), _closing, Icons.access_time_filled_rounded)),
                ],
              ),
              const SizedBox(height: 48),
              FilledButton(
                onPressed: _busy ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0F172A),
                  minimumSize: const Size(double.infinity, 60),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                ),
                child: Text('common.save'.tr(), style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16, left: 4),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey.shade500, letterSpacing: 1.1),
      ),
    );
  }

  Widget _inputField(String label, TextEditingController controller, IconData icon, {bool isNumber = false}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)],
      ),
      child: TextFormField(
        controller: controller,
        keyboardType: isNumber ? TextInputType.number : TextInputType.text,
        style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, size: 20),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none),
          filled: true,
          fillColor: Colors.transparent,
        ),
        validator: (v) => v == null || v.isEmpty ? 'Gerekli' : null,
      ),
    );
  }
}

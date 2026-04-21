import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../shared/models/booking.dart';
import '../booking/booking_detail_screen.dart';

class PartnerBookingDetailScreen extends ConsumerStatefulWidget {
  const PartnerBookingDetailScreen({super.key, required this.bookingId});
  final String bookingId;

  @override
  ConsumerState<PartnerBookingDetailScreen> createState() => _PartnerBookingDetailScreenState();
}

class _PartnerBookingDetailScreenState extends ConsumerState<PartnerBookingDetailScreen> {
  final List<TextEditingController> _sealControllers = [];
  bool _busy = false;

  void _initControllers(BookingDto b) {
    if (_sealControllers.length == b.totalBags) return;
    _sealControllers.clear();
    for (int i = 0; i < b.totalBags; i++) {
      _sealControllers.add(TextEditingController());
    }
  }

  Future<void> _checkIn(BookingDto b) async {
    final assignments = [];
    for (int i = 0; i < _sealControllers.length; i++) {
      final val = int.tryParse(_sealControllers[i].text);
      if (val == null) {
        HapticFeedback.vibrate();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lütfen tüm mühür numaralarını doğru bir şekilde girin.')),
        );
        return;
      }
      assignments.add({
        'sealNumber': val,
        'bagIndex': i,
        'bagSize': i < b.bagCountS ? 'S' : (i < b.bagCountS + b.bagCountM ? 'M' : 'XL'),
      });
    }

    setState(() => _busy = true);
    HapticFeedback.mediumImpact();
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/bookings/${b.id}/check-in', data: {
        'sealAssignments': assignments,
      });
      if (mounted) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Valizler başarıyla teslim alındı!')));
        ref.invalidate(bookingProvider(b.id));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _checkOut(BookingDto b) async {
    setState(() => _busy = true);
    HapticFeedback.mediumImpact();
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/bookings/${b.id}/check-out');
      if (mounted) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Valizler misafire başarıyla teslim edildi!')));
        ref.invalidate(bookingProvider(b.id));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    for (var c in _sealControllers) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bAsync = ref.watch(bookingProvider(widget.bookingId));
    final fmt = DateFormat('dd MMM, HH:mm');

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('İşlem Detayı', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: bAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Bir hata oluştu: $e')),
        data: (b) {
          _initControllers(b);
          final statusColor = _statusColor(b.status);
          
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              // Guest Header Card
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 20, offset: const Offset(0, 4)),
                  ],
                ),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 35,
                      backgroundColor: const Color(0xFFF97316).withOpacity(0.1),
                      child: Text(
                        b.guestName?.substring(0, 1).toUpperCase() ?? 'G',
                        style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.bold, color: const Color(0xFFF97316)),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      b.guestName ?? 'Misafir',
                      style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: Text(
                        _statusLabel(b.status),
                        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: statusColor),
                      ),
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 24),
              
              // Times Section
              Row(
                children: [
                  _timeCard('Teslimat', fmt.format(b.checkInTime), Icons.login_rounded, Colors.blue),
                  const SizedBox(width: 12),
                  _timeCard('Teslim Alım', fmt.format(b.checkOutTime), Icons.logout_rounded, Colors.teal),
                ],
              ),
              
              const SizedBox(height: 24),
              
              // Bags Info
              Text(
                'VALİZ DETAYLARI',
                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey.shade500, letterSpacing: 1.1),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _bagInfo('S', b.bagCountS),
                    _bagInfo('M', b.bagCountM),
                    _bagInfo('XL', b.bagCountXl),
                  ],
                ),
              ),
              
              const SizedBox(height: 32),
              
              // Operational Area
              if (b.status == BookingStatus.PAID || b.status == BookingStatus.APPROVED) ...[
                Text(
                  'MÜHÜR ATAMALARI',
                  style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey.shade500, letterSpacing: 1.1),
                ),
                const SizedBox(height: 12),
                for (int i = 0; i < b.totalBags; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: TextField(
                      controller: _sealControllers[i],
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: '${i + 1}. Valiz Mühür Numarası',
                        hintText: 'Örn: 12345',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: FilledButton.icon(
                    onPressed: _busy ? null : () => _checkIn(b),
                    icon: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Icon(Icons.check_circle_rounded),
                    label: const Text('Valizleri Teslim Al (Check-in)'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                  ),
                ),
              ],
              
              if (b.status == BookingStatus.CHECKED_IN) ...[
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: FilledButton.icon(
                    onPressed: _busy ? null : () => _checkOut(b),
                    icon: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Icon(Icons.exit_to_app_rounded),
                    label: const Text('Valizleri Teslim Et (Check-out)'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF3B82F6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                  ),
                ),
              ],
              
              const SizedBox(height: 40),
            ],
          );
        },
      ),
    );
  }

  Widget _timeCard(String label, String time, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 14, color: color),
                const SizedBox(width: 6),
                Text(label, style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
            const SizedBox(height: 8),
            Text(time, style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _bagInfo(String size, int count) {
    return Column(
      children: [
        Text(size, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
        const SizedBox(height: 4),
        Text('$count', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
      ],
    );
  }

  String _statusLabel(BookingStatus status) {
    switch (status) {
      case BookingStatus.PENDING: return 'ÖDEME BEKLİYOR';
      case BookingStatus.PAID: return 'ÖDENDİ';
      case BookingStatus.APPROVED: return 'ONAYLANDI';
      case BookingStatus.CHECKED_IN: return 'EMANET ALINDI';
      case BookingStatus.CHECKED_OUT: return 'TESLİM EDİLDİ';
      case BookingStatus.CANCELLED: return 'İPTAL EDİLDİ';
      case BookingStatus.WAITING_APPROVAL: return 'ONAY BEKLİYOR';
    }
  }

  Color _statusColor(BookingStatus status) {
    switch (status) {
      case BookingStatus.PAID:
      case BookingStatus.APPROVED: return Colors.green;
      case BookingStatus.CHECKED_IN: return Colors.blue;
      case BookingStatus.CANCELLED: return Colors.redAccent;
      case BookingStatus.CHECKED_OUT: return Colors.grey;
      case BookingStatus.WAITING_APPROVAL: return Colors.orange;
      default: return Colors.orange;
    }
  }
}

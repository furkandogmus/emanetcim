import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../shared/models/booking.dart';

final bookingProvider = FutureProvider.family<BookingDto, String>((ref, id) async {
  try {
    final res = await ref.watch(dioProvider).get('/bookings/$id');
    return BookingDto.fromJson(res.data as Map<String, dynamic>);
  } catch (e) {
    rethrow;
  }
});

class BookingDetailScreen extends ConsumerWidget {
  const BookingDetailScreen({super.key, required this.bookingId});
  final String bookingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookingAsync = ref.watch(bookingProvider(bookingId));
    final theme = Theme.of(context);
    final fmt = DateFormat('dd MMMM yyyy, HH:mm');

    return Scaffold(
      appBar: AppBar(
        title: Text('Rezervasyon Detayı', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
      ),
      body: bookingAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, size: 64, color: Colors.redAccent),
              const SizedBox(height: 16),
              const Text('Rezervasyon yüklenemedi'),
              TextButton(onPressed: () => ref.refresh(bookingProvider(bookingId)), child: const Text('Tekrar Dene')),
            ],
          ),
        ),
        data: (bk) => SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              // Ticket Design
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 30,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          Text(
                            bk.shopName,
                            style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          _statusBadge(bk.status),
                        ],
                      ),
                    ),
                    const _DashedLine(),
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          if (bk.qrCodeToken != null) ...[
                            QrImageView(
                              data: bk.qrCodeToken!,
                              size: 200,
                              eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Color(0xFF0F172A)),
                              dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Color(0xFF0F172A)),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Bu kodu dükkan sahibine gösterin',
                              style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey.shade500),
                            ),
                            const SizedBox(height: 32),
                          ],
                          _infoRow('Giriş', fmt.format(bk.checkInTime)),
                          const SizedBox(height: 16),
                          _infoRow('Çıkış', fmt.format(bk.checkOutTime)),
                          const SizedBox(height: 16),
                          _infoRow('Valizler', '${bk.totalBags} Adet (S:${bk.bagCountS}, M:${bk.bagCountM}, XL:${bk.bagCountXl})'),
                          const SizedBox(height: 16),
                          _infoRow('Toplam Tutar', '₺${bk.totalPrice.toStringAsFixed(2)}', isBold: true),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 32),
              
              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _launchMaps(bk.shopName),
                      icon: const Icon(Icons.map_rounded),
                      label: const Text('Yol Tarifi'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.phone_rounded),
                      label: const Text('Dükkanı Ara'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 16),
              
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.help_outline_rounded, size: 20),
                  label: const Text('Destek Al'),
                  style: TextButton.styleFrom(foregroundColor: Colors.grey.shade600),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusBadge(BookingStatus status) {
    Color color = Colors.orange;
    String label = 'Beklemede';
    
    switch (status) {
      case BookingStatus.PAID:
      case BookingStatus.APPROVED:
        color = Colors.green;
        label = 'Onaylandı';
        break;
      case BookingStatus.CHECKED_IN:
        color = Colors.blue;
        label = 'Emanet Alındı';
        break;
      case BookingStatus.CHECKED_OUT:
        color = Colors.grey;
        label = 'Teslim Edildi';
        break;
      case BookingStatus.CANCELLED:
        color = Colors.redAccent;
        label = 'İptal Edildi';
        break;
      case BookingStatus.WAITING_APPROVAL:
        color = Colors.orange;
        label = 'Onay Bekliyor';
        break;
      default: break;
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Text(
        label,
        style: GoogleFonts.outfit(color: color, fontWeight: FontWeight.bold, fontSize: 14),
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.outfit(color: Colors.grey.shade500)),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: GoogleFonts.outfit(
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              fontSize: isBold ? 16 : 14,
              color: const Color(0xFF0F172A),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _launchMaps(String query) async {
    final url = Uri.parse('https://www.google.com/maps/search/?api=1&query=$query');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }
}

class _DashedLine extends StatelessWidget {
  const _DashedLine();
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: List.generate(
          20,
          (index) => Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              height: 1,
              color: Colors.grey.shade200,
            ),
          ),
        ),
      ),
    );
  }
}

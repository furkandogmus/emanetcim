import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../shared/models/booking.dart';

final partnerBookingsProvider = FutureProvider<List<BookingDto>>((ref) async {
  try {
    await Future.delayed(const Duration(milliseconds: 800));
    return [
      BookingDto(
        id: 'b-1',
        shopId: 's-1',
        shopName: 'Galata Shop',
        guestName: 'Ahmet Yılmaz',
        bagCountS: 2,
        bagCountM: 0,
        bagCountXl: 0,
        checkInTime: DateTime.now().add(const Duration(hours: -2)),
        checkOutTime: DateTime.now().add(const Duration(hours: 4)),
        status: BookingStatus.CHECKED_IN,
        totalPrice: 120.0,
      ),
      BookingDto(
        id: 'b-2',
        shopId: 's-1',
        shopName: 'Galata Shop',
        guestName: 'Sarah Connor',
        bagCountS: 1,
        bagCountM: 0,
        bagCountXl: 0,
        checkInTime: DateTime.now().add(const Duration(hours: 1)),
        checkOutTime: DateTime.now().add(const Duration(hours: 5)),
        status: BookingStatus.PAID,
        totalPrice: 60.0,
      ),
      BookingDto(
        id: 'b-3',
        shopId: 's-1',
        shopName: 'Galata Shop',
        guestName: 'Mehmet Demir',
        bagCountS: 3,
        bagCountM: 0,
        bagCountXl: 0,
        checkInTime: DateTime.now().add(const Duration(days: -1)),
        checkOutTime: DateTime.now().add(const Duration(hours: -1)),
        status: BookingStatus.CHECKED_OUT,
        totalPrice: 180.0,
      ),
    ];
  } catch (e) {
    return [];
  }
});

class PartnerBookingsScreen extends ConsumerWidget {
  const PartnerBookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookingsAsync = ref.watch(partnerBookingsProvider);
    final theme = Theme.of(context);
    final fmt = DateFormat('HH:mm');

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 140,
            floating: true,
            pinned: true,
            backgroundColor: const Color(0xFFF97316),
            flexibleSpace: FlexibleSpaceBar(
              title: Text('Dükkan Paneli', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white)),
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFFF97316), Color(0xFFEA580C)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            ),
            actions: [
              IconButton(
                onPressed: () => context.push('/partner/scan'),
                icon: const Icon(Icons.qr_code_scanner_rounded, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 8),
            ],
          ),
          
          bookingsAsync.when(
            loading: () => const SliverToBoxAdapter(child: LinearProgressIndicator()),
            error: (e, _) => const SliverToBoxAdapter(child: SizedBox()),
            data: (list) {
              final activeBags = list.where((b) => b.status == BookingStatus.CHECKED_IN).fold(0, (sum, b) => sum + b.totalBags);
              final earnings = list.where((b) => b.status != BookingStatus.CANCELLED).fold(0.0, (sum, b) => sum + b.totalPrice);
              
              return SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      _buildSummaryCard(
                        'Aktif Valiz',
                        '$activeBags',
                        Icons.luggage_rounded,
                        const Color(0xFFF97316),
                      ),
                      const SizedBox(width: 12),
                      _buildSummaryCard(
                        'Toplam Kazanç',
                        '₺${earnings.toStringAsFixed(0)}',
                        Icons.payments_rounded,
                        const Color(0xFF10B981),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Text(
                    'Rezervasyonlar',
                    style: GoogleFonts.outfit(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),

          bookingsAsync.when(
            loading: () => const SliverFillRemaining(child: Center(child: CircularProgressIndicator())),
            error: (e, _) => SliverFillRemaining(child: Center(child: Text('Hata: $e'))),
            data: (list) => SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final b = list[index];
                    return _BookingPartnerCard(booking: b, fmt: fmt);
                  },
                  childCount: list.length,
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(String title, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 12),
            Text(value, style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold)),
            Text(title, style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey.shade600)),
          ],
        ),
      ),
    );
  }
}

class _BookingPartnerCard extends StatelessWidget {
  final BookingDto booking;
  final DateFormat fmt;

  const _BookingPartnerCard({required this.booking, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor(booking.status);
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: InkWell(
        onTap: () => context.push('/partner/booking/${booking.id}'),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Bag Count Circle
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFF97316).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '${booking.totalBags}',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFFF97316)),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              
              // Guest Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      booking.guestName ?? 'Misafir',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${fmt.format(booking.checkInTime)} - ${fmt.format(booking.checkOutTime)}',
                      style: GoogleFonts.outfit(fontSize: 13, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
              
              // Status & Price
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _getStatusText(booking.status),
                      style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '₺${booking.totalPrice}',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getStatusColor(BookingStatus status) {
    switch (status) {
      case BookingStatus.WAITING_APPROVAL: return Colors.orange;
      case BookingStatus.APPROVED: return Colors.blue;
      case BookingStatus.PENDING: return Colors.indigo;
      case BookingStatus.PAID: return Colors.teal;
      case BookingStatus.CHECKED_IN: return Colors.green;
      case BookingStatus.CHECKED_OUT: return Colors.grey;
      case BookingStatus.CANCELLED: return Colors.red;
    }
  }

  String _getStatusText(BookingStatus status) {
    switch (status) {
      case BookingStatus.WAITING_APPROVAL: return 'ONAY BEKLİYOR';
      case BookingStatus.APPROVED: return 'ONAYLANDI';
      case BookingStatus.PENDING: return 'ÖDEME BEKLİYOR';
      case BookingStatus.PAID: return 'ÖDENDİ';
      case BookingStatus.CHECKED_IN: return 'TESLİM ALINDI';
      case BookingStatus.CHECKED_OUT: return 'TESLİM EDİLDİ';
      case BookingStatus.CANCELLED: return 'İPTAL';
    }
  }
}

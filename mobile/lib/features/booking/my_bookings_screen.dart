import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../shared/models/booking.dart';

final myBookingsProvider = FutureProvider<List<BookingDto>>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get('/bookings/me');
    return (res.data as List).map((e) => BookingDto.fromJson(e as Map<String, dynamic>)).toList();
  } catch (e) {
    return [];
  }
});

class MyBookingsScreen extends ConsumerWidget {
  const MyBookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookingsAsync = ref.watch(myBookingsProvider);
    final theme = Theme.of(context);
    final fmt = DateFormat('dd MMM HH:mm');

    return Scaffold(
      appBar: AppBar(
        title: Text('Rezervasyonlarım', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            onPressed: () => ref.refresh(myBookingsProvider.future),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: bookingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, size: 64, color: Colors.redAccent),
              const SizedBox(height: 16),
              Text('Bir hata oluştu', style: theme.textTheme.headlineSmall),
              TextButton(
                onPressed: () => ref.refresh(myBookingsProvider.future),
                child: const Text('Tekrar Dene'),
              ),
            ],
          ),
        ),
        data: (list) {
          if (list.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.luggage_outlined, size: 80, color: Color(0xFFF97316)),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Henüz rezervasyonun yok',
                    style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Seyahatine başlamak için bir dükkan bul!',
                    style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 32),
                  FilledButton.icon(
                    onPressed: () => context.go('/'),
                    icon: const Icon(Icons.search_rounded),
                    label: const Text('Keşfetmeye Başla'),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.refresh(myBookingsProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
              itemCount: list.length,
              itemBuilder: (context, i) {
                final b = list[i];
                final statusColor = _statusColor(b.status);
                
                return Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: GestureDetector(
                    onTap: () => context.push('/booking/${b.id}'),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.04),
                            blurRadius: 20,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                              color: statusColor.withOpacity(0.08),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Icon(Icons.calendar_today_rounded, size: 14, color: statusColor),
                                      const SizedBox(width: 8),
                                      Text(
                                        'ID: #${b.id.substring(b.id.length - 6).toUpperCase()}',
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: statusColor,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: statusColor,
                                      borderRadius: BorderRadius.circular(100),
                                    ),
                                    child: Text(
                                      _statusLabel(b.status),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(20),
                              child: Row(
                                children: [
                                  Container(
                                    width: 60,
                                    height: 60,
                                    decoration: BoxDecoration(
                                      color: Colors.orange.shade50,
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: const Icon(Icons.storefront_rounded, color: Color(0xFFF97316)),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          b.shopName,
                                          style: GoogleFonts.outfit(
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFF0F172A),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '${fmt.format(b.checkInTime)} → ${fmt.format(b.checkOutTime)}',
                                          style: GoogleFonts.outfit(
                                            fontSize: 13,
                                            color: Colors.grey.shade600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Divider(height: 1, indent: 20, endIndent: 20),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.luggage_rounded, size: 18, color: Colors.grey),
                                      const SizedBox(width: 8),
                                      Text(
                                        '${b.totalBags} Valiz',
                                        style: GoogleFonts.outfit(
                                          fontWeight: FontWeight.w600,
                                          color: const Color(0xFF0F172A),
                                        ),
                                      ),
                                    ],
                                  ),
                                  Text(
                                    '₺${b.totalPrice.toStringAsFixed(2)}',
                                    style: GoogleFonts.outfit(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFFF97316),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  String _statusLabel(BookingStatus status) {
    switch (status) {
      case BookingStatus.PENDING: return 'Beklemede';
      case BookingStatus.PAID: return 'Ödendi';
      case BookingStatus.APPROVED: return 'Onaylandı';
      case BookingStatus.CHECKED_IN: return 'Emanet Alındı';
      case BookingStatus.CHECKED_OUT: return 'Teslim Edildi';
      case BookingStatus.CANCELLED: return 'İptal Edildi';
      case BookingStatus.WAITING_APPROVAL: return 'Onay Bekliyor';
    }
  }

  Color _statusColor(BookingStatus status) {
    switch (status) {
      case BookingStatus.PAID:
      case BookingStatus.APPROVED:
        return Colors.green;
      case BookingStatus.CHECKED_IN:
        return Colors.blue;
      case BookingStatus.CANCELLED:
        return Colors.redAccent;
      case BookingStatus.CHECKED_OUT:
        return Colors.grey;
      case BookingStatus.WAITING_APPROVAL:
        return Colors.orange;
      default:
        return Colors.orange;
    }
  }
}

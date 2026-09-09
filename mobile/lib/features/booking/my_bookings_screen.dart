import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/repositories/booking_repository.dart';
import '../../shared/models/booking.dart';
import '../../shared/utils/app_colors.dart';
import '../../shared/utils/booking_helpers.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/error_state.dart';
import '../../shared/widgets/skeleton.dart';

final myBookingsProvider = FutureProvider<List<BookingDto>>((ref) async {
  final result = await ref.watch(bookingRepositoryProvider).getMyBookings();
  return result.fold((data) => data, (error) => throw Exception(error));
});

class MyBookingsScreen extends ConsumerWidget {
  const MyBookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookingsAsync = ref.watch(myBookingsProvider);
    final fmt = DateFormat('dd MMM HH:mm');

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'nav.bookings'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            onPressed: () => ref.refresh(myBookingsProvider.future),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: bookingsAsync.when(
        loading: _buildSkeleton,
        error: (e, _) => ErrorState(
          title: 'common.error'.tr(),
          actionLabel: 'common.try_again'.tr(),
          onAction: () => ref.refresh(myBookingsProvider.future),
        ),
        data: (list) {
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.luggage_outlined,
              title: 'booking.no_bookings'.tr(),
              description: 'booking.no_bookings_desc'.tr(),
              actionLabel: 'booking.start_exploring'.tr(),
              actionIcon: Icons.search_rounded,
              onAction: () => context.go('/'),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.refresh(myBookingsProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
              itemCount: list.length,
              itemBuilder: (context, i) {
                final b = list[i];
                final statusColor = bookingStatusColor(b.status);

                return Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: GestureDetector(
                    onTap: () => context.push('/booking/${b.id}'),
                    child: DecoratedBox(
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
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 20,
                                vertical: 12,
                              ),
                              color: statusColor.withValues(alpha: 0.08),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Icon(
                                        Icons.calendar_today_rounded,
                                        size: 14,
                                        color: statusColor,
                                      ),
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
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: statusColor,
                                      borderRadius: BorderRadius.circular(100),
                                    ),
                                    child: Text(
                                      bookingStatusLabel(b.status),
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
                                    child: const Icon(
                                      Icons.storefront_rounded,
                                      color: AppColors.brandOrange,
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
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
                                            color: const Color(0xFF424242),
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
                              padding: const EdgeInsets.symmetric(
                                horizontal: 20,
                                vertical: 16,
                              ),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.luggage_rounded,
                                        size: 18,
                                        color: Color(0xFF616161),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        '${b.totalBags} ${'checkout.bag_s'.tr()}',
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
                                      color: AppColors.brandOrange,
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

  Widget _buildSkeleton() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      itemCount: 4,
      itemBuilder: (context, i) => const Padding(
        padding: EdgeInsets.only(bottom: 20),
        child: Skeleton(height: 140, borderRadius: 24),
      ),
    );
  }
}

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/repositories/booking_repository.dart';
import '../../shared/models/booking.dart';
import '../../shared/utils/app_colors.dart';
import '../../shared/utils/booking_helpers.dart';
import '../../shared/widgets/skeleton.dart';

final partnerBookingsProvider = FutureProvider<List<BookingDto>>((ref) async {
  final result = await ref
      .watch(bookingRepositoryProvider)
      .getPartnerBookings();
  return result.fold((data) => data, (error) => throw Exception(error));
});

class PartnerBookingsScreen extends ConsumerStatefulWidget {
  const PartnerBookingsScreen({super.key});

  @override
  ConsumerState<PartnerBookingsScreen> createState() =>
      _PartnerBookingsScreenState();
}

class _PartnerBookingsScreenState extends ConsumerState<PartnerBookingsScreen> {
  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    final bookingsAsync = ref.watch(partnerBookingsProvider);
    final fmt = DateFormat('HH:mm');

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 140,
            floating: true,
            pinned: true,
            backgroundColor: AppColors.brandOrange,
            flexibleSpace: FlexibleSpaceBar(
              title: Text(
                'nav.partner'.tr(),
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.brandOrange, AppColors.brandOrangeDark],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            ),
            actions: [
              IconButton(
                onPressed: () => _showHowItWorks(context),
                icon: const Icon(
                  Icons.help_outline_rounded,
                  color: Colors.white,
                ),
              ),
              IconButton(
                onPressed: () => context.push('/partner/scan'),
                icon: const Icon(
                  Icons.qr_code_scanner_rounded,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(width: 8),
            ],
          ),

          bookingsAsync.when(
            loading: () => const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(child: Skeleton(height: 100, borderRadius: 20)),
                    SizedBox(width: 12),
                    Expanded(child: Skeleton(height: 100, borderRadius: 20)),
                  ],
                ),
              ),
            ),
            error: (e, _) => const SliverToBoxAdapter(child: SizedBox()),
            data: (list) {
              final activeBags = list
                  .where((b) => b.status == BookingStatus.checkedIn)
                  .fold(0, (sum, b) => sum + b.totalBags);
              final earnings = list
                  .where((b) => b.status != BookingStatus.cancelled)
                  .fold(0.0, (sum, b) => sum + b.totalPrice);

              return SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      _buildSummaryCard(
                        'partner.active_bags'.tr(),
                        '$activeBags',
                        Icons.luggage_rounded,
                        AppColors.brandOrange,
                      ),
                      const SizedBox(width: 12),
                      _buildSummaryCard(
                        'partner.total_earnings'.tr(),
                        '₺${earnings.toStringAsFixed(0)}',
                        Icons.payments_rounded,
                        AppColors.success,
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
                    'partner.bookings_title'.tr(),
                    style: GoogleFonts.outfit(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textDark,
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),

          bookingsAsync.when(
            loading: () => SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) => const Padding(
                    padding: EdgeInsets.only(bottom: 12),
                    child: Skeleton(height: 80, borderRadius: 16),
                  ),
                  childCount: 5,
                ),
              ),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(child: Text('common.error'.tr())),
            ),
            data: (list) => list.isEmpty
                ? SliverFillRemaining(
                    child: Center(child: Text('partner.no_bookings'.tr())),
                  )
                : SliverPadding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate((context, index) {
                        final b = list[index];
                        return _BookingPartnerCard(booking: b, fmt: fmt);
                      }, childCount: list.length),
                    ),
                  ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(
    String title,
    String value,
    IconData icon,
    Color color,
  ) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 12),
            Text(
              value,
              style: GoogleFonts.outfit(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              title,
              style: GoogleFonts.outfit(
                fontSize: 12,
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showHowItWorks(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'home.how_it_works'.tr(),
              style: GoogleFonts.outfit(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.textDark,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            _tutorialStep(
              Icons.qr_code_scanner_rounded,
              'partner.step1.title'.tr(),
              'partner.step1.desc'.tr(),
            ),
            _tutorialStep(
              Icons.verified_user_rounded,
              'partner.step2.title'.tr(),
              'partner.step2.desc'.tr(),
            ),
            _tutorialStep(
              Icons.payments_rounded,
              'partner.step3.title'.tr(),
              'partner.step3.desc'.tr(),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.brandOrange,
                minimumSize: const Size(double.infinity, 56),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: Text(
                'common.done'.tr(),
                style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tutorialStep(IconData icon, String title, String desc) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.brandOrange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: AppColors.brandOrange, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  desc,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    color: Colors.grey.shade600,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
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
    final statusColor = bookingStatusColor(booking.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: InkWell(
        onTap: () => context.push('/partner/booking/${booking.id}'),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.brandOrange.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '${booking.totalBags}',
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.bold,
                      color: AppColors.brandOrange,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      booking.guestName ?? 'Misafir',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${fmt.format(booking.checkInTime)} - ${fmt.format(booking.checkOutTime)}',
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      bookingStatusLabel(booking.status),
                      style: GoogleFonts.outfit(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: statusColor,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '₺${booking.totalPrice}',
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

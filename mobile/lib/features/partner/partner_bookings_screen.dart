import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../shared/models/booking.dart';

final partnerBookingsProvider = FutureProvider<List<BookingDto>>((ref) async {
  final box = Hive.box('partner_bookings_cache');
  try {
    final dio = ref.watch(dioProvider);
    final res = await dio.get('/partner/bookings');
    final list = res.data as List<dynamic>;
    final bookings = list
        .map((e) => BookingDto.fromJson(e as Map<String, dynamic>))
        .toList();

    // Cache the raw list for offline use
    await box.put('list', list);
    return bookings;
  } catch (e) {
    // If offline, try to return cached data
    final cached = box.get('list');
    if (cached != null) {
      return (cached as List<dynamic>)
          .map((e) => BookingDto.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }

    // Demo/Fallback data
    return [
      BookingDto(
        id: 'b-demo-1',
        shopId: 's-1',
        shopName: 'Emanetçi Galata (Demo)',
        guestName: 'Örnek Misafir',
        bagCountS: 1,
        bagCountM: 1,
        bagCountXl: 0,
        checkInTime: DateTime.now().add(const Duration(hours: -1)),
        checkOutTime: DateTime.now().add(const Duration(hours: 3)),
        status: BookingStatus.checkedIn,
        totalPrice: 150.0,
      ),
    ];
  }
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkDemoMode();
    });
  }

  void _checkDemoMode() {
    final isDemo = ref.read(authControllerProvider).isDemo;
    if (isDemo) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          title: Row(
            children: [
              const Icon(Icons.science_rounded, color: Color(0xFFF97316)),
              const SizedBox(width: 12),
              Text(
                'partner.demo_welcome_title'.tr(),
                style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: Text(
            'partner.demo_welcome_msg'.tr(),
            style: GoogleFonts.outfit(),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFF97316),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text('common.confirm'.tr()),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bookingsAsync = ref.watch(partnerBookingsProvider);
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
                    colors: [Color(0xFFF97316), Color(0xFFEA580C)],
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
            loading: () =>
                const SliverToBoxAdapter(child: LinearProgressIndicator()),
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
                        const Color(0xFFF97316),
                      ),
                      const SizedBox(width: 12),
                      _buildSummaryCard(
                        'partner.total_earnings'.tr(),
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
                    'partner.bookings_title'.tr(),
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
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
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
                color: const Color(0xFF0F172A),
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
                backgroundColor: const Color(0xFFF97316),
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
              color: const Color(0xFFF97316).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: const Color(0xFFF97316), size: 24),
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
                    color: const Color(0xFF0F172A),
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
    final statusColor = _getStatusColor(booking.status);

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
                  color: const Color(0xFFF97316).withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '${booking.totalBags}',
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFFF97316),
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
                      _getStatusText(booking.status),
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

  Color _getStatusColor(BookingStatus status) {
    switch (status) {
      case BookingStatus.paid:
      case BookingStatus.approved:
        return Colors.green;
      case BookingStatus.checkedIn:
        return Colors.blue;
      case BookingStatus.cancelled:
        return Colors.redAccent;
      case BookingStatus.checkedOut:
        return Colors.grey;
      case BookingStatus.waitingApproval:
        return Colors.orange;
      default:
        return Colors.orange;
    }
  }

  String _getStatusText(BookingStatus status) {
    String key = 'waiting_approval';
    switch (status) {
      case BookingStatus.pending:
        key = 'pending';
        break;
      case BookingStatus.paid:
        key = 'paid';
        break;
      case BookingStatus.approved:
        key = 'approved';
        break;
      case BookingStatus.checkedIn:
        key = 'checked_in';
        break;
      case BookingStatus.checkedOut:
        key = 'checked_out';
        break;
      case BookingStatus.cancelled:
        key = 'cancelled';
        break;
      case BookingStatus.waitingApproval:
        key = 'waiting_approval';
        break;
    }
    return 'booking.status.$key'.tr();
  }
}

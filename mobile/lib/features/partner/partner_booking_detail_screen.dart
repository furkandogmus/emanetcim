import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../core/sync/sync_service.dart';
import '../../shared/models/booking.dart';
import 'package:dio/dio.dart';
import '../booking/booking_detail_screen.dart';

class PartnerBookingDetailScreen extends ConsumerStatefulWidget {
  const PartnerBookingDetailScreen({super.key, required this.bookingId});
  final String bookingId;

  @override
  ConsumerState<PartnerBookingDetailScreen> createState() =>
      _PartnerBookingDetailScreenState();
}

class _PartnerBookingDetailScreenState
    extends ConsumerState<PartnerBookingDetailScreen> {
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
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('common.error'.tr())));
        return;
      }
      assignments.add({
        'sealNumber': val,
        'bagIndex': i,
        'bagSize': i < b.bagCountS
            ? 'S'
            : (i < b.bagCountS + b.bagCountM ? 'M' : 'XL'),
      });
    }

    setState(() => _busy = true);
    HapticFeedback.mediumImpact();
    try {
      final dio = ref.read(dioProvider);
      await dio.post(
        '/bookings/${b.id}/check-in',
        data: {'sealAssignments': assignments},
      );
      if (mounted) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('partner.success_checkin'.tr())));
        ref.invalidate(bookingProvider(b.id));
      }
    } catch (e) {
      if (e is DioException &&
          (e.type == DioExceptionType.connectionError ||
              e.type == DioExceptionType.connectionTimeout)) {
        // Offline mode fallback
        final syncService = ref.read(syncServiceProvider);
        await syncService.addAction(SyncActionType.checkIn, b.id, {
          'sealAssignments': assignments,
        });
        if (mounted) {
          HapticFeedback.mediumImpact();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('partner.offline_saved'.tr()),
              backgroundColor: Colors.orange,
            ),
          );
          // Mock local update or just pop
          Navigator.pop(context);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('${'common.error'.tr()}: $e')));
        }
      }
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('partner.success_checkout'.tr())),
        );
        ref.invalidate(bookingProvider(b.id));
      }
    } catch (e) {
      if (e is DioException &&
          (e.type == DioExceptionType.connectionError ||
              e.type == DioExceptionType.connectionTimeout)) {
        // Offline mode fallback
        final syncService = ref.read(syncServiceProvider);
        await syncService.addAction(SyncActionType.checkOut, b.id);
        if (mounted) {
          HapticFeedback.mediumImpact();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('partner.offline_saved'.tr()),
              backgroundColor: Colors.orange,
            ),
          );
          Navigator.pop(context);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('${'common.error'.tr()}: $e')));
        }
      }
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
        title: Text(
          'nav.partner'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
      ),
      body: bAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('common.error'.tr())),
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
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 20,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 35,
                      backgroundColor: const Color(
                        0xFFF97316,
                      ).withValues(alpha: 0.1),
                      child: Text(
                        b.guestName?.substring(0, 1).toUpperCase() ?? 'G',
                        style: GoogleFonts.outfit(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFF97316),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      b.guestName ?? 'Misafir',
                      style: GoogleFonts.outfit(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: Text(
                        _statusLabel(b.status),
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Times Section
              Row(
                children: [
                  _timeCard(
                    'checkout.check_in'.tr(),
                    fmt.format(b.checkInTime),
                    Icons.login_rounded,
                    Colors.blue,
                  ),
                  const SizedBox(width: 12),
                  _timeCard(
                    'checkout.check_out'.tr(),
                    fmt.format(b.checkOutTime),
                    Icons.logout_rounded,
                    Colors.teal,
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Bags Info
              Text(
                'checkout.bags_title'.tr(),
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey.shade500,
                  letterSpacing: 1.1,
                ),
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
              if (b.status == BookingStatus.paid ||
                  b.status == BookingStatus.approved) ...[
                Text(
                  'partner.check_in_button'.tr().toUpperCase(),
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade500,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 12),
                for (int i = 0; i < b.totalBags; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: TextField(
                      controller: _sealControllers[i],
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'partner.seal_hint'.tr(
                          args: [(i + 1).toString()],
                        ),
                        hintText: 'partner.seal_placeholder'.tr(),
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 16,
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: FilledButton.icon(
                    onPressed: _busy ? null : () => _checkIn(b),
                    icon: _busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.check_circle_rounded),
                    label: Text('partner.check_in_button'.tr()),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
              ],

              if (b.status == BookingStatus.checkedIn) ...[
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: FilledButton.icon(
                    onPressed: _busy ? null : () => _checkOut(b),
                    icon: _busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.exit_to_app_rounded),
                    label: Text('partner.check_out_button'.tr()),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF3B82F6),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
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
                Text(
                  label,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              time,
              style: GoogleFonts.outfit(
                fontSize: 15,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bagInfo(String size, int count) {
    return Column(
      children: [
        Text(
          size,
          style: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: Colors.grey,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '$count',
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF0F172A),
          ),
        ),
      ],
    );
  }

  String _statusLabel(BookingStatus status) {
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

  Color _statusColor(BookingStatus status) {
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
}

import 'dart:async' show Timer, unawaited;

import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../core/sync/sync_service.dart';
import '../../shared/models/booking.dart';
import '../../shared/utils/app_colors.dart';
import '../../shared/utils/booking_helpers.dart';
import '../booking/booking_detail_screen.dart';

class PartnerBookingDetailScreen extends ConsumerStatefulWidget {
  const PartnerBookingDetailScreen({required this.bookingId, super.key});
  final String bookingId;

  @override
  ConsumerState<PartnerBookingDetailScreen> createState() =>
      _PartnerBookingDetailScreenState();
}

class _PartnerBookingDetailScreenState
    extends ConsumerState<PartnerBookingDetailScreen> {
  bool _busy = false;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _pollingTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      final current = ref.read(bookingProvider(widget.bookingId));
      final status = current.asData?.value.status;
      final isTerminal =
          status == BookingStatus.checkedOut ||
          status == BookingStatus.cancelled;
      if (isTerminal) {
        timer.cancel();
        return;
      }
      ref.invalidate(bookingProvider(widget.bookingId));
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkIn(BookingDto b) async {
    setState(() => _busy = true);
    unawaited(HapticFeedback.mediumImpact());
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/bookings/${b.id}/check-in');
      if (mounted) {
        unawaited(HapticFeedback.heavyImpact());
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
        await syncService.addAction(SyncActionType.checkIn, b.id, {});
        if (mounted) {
          unawaited(HapticFeedback.mediumImpact());
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
    unawaited(HapticFeedback.mediumImpact());
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/bookings/${b.id}/check-out');
      if (mounted) {
        unawaited(HapticFeedback.heavyImpact());
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
          unawaited(HapticFeedback.mediumImpact());
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

  Future<void> _approveBooking(BookingDto b) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('booking.approve'.tr()),
        content: Text('booking.approve_confirm'.tr()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('common.cancel'.tr()),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('booking.approve'.tr()),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _busy = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/partner/bookings/${b.id}/approve');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('booking.approve_success'.tr())));
        ref.invalidate(bookingProvider(b.id));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('common.error'.tr())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _rejectBooking(BookingDto b) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('booking.reject'.tr()),
        content: Text('booking.reject_confirm'.tr()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('common.cancel'.tr()),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('booking.reject'.tr()),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _busy = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/partner/bookings/${b.id}/reject');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('booking.reject_success'.tr())));
        ref.invalidate(bookingProvider(b.id));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('common.error'.tr())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showBagRevisionSheet(BookingDto b) async {
    final dio = ref.read(dioProvider);
    final success = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _BagRevisionBottomSheet(booking: b, dio: dio),
    );

    if (success == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('partner.bag_revision_success'.tr()),
          backgroundColor: Colors.green,
        ),
      );
      ref.invalidate(bookingProvider(b.id));
    }
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
        skipLoadingOnReload: true,
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('common.error'.tr())),
        data: (b) {
          final statusColor = bookingStatusColor(b.status);

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
                      backgroundColor: AppColors.brandOrange.withValues(
                        alpha: 0.1,
                      ),
                      child: Text(
                        (b.guestName != null && b.guestName!.isNotEmpty)
                            ? b.guestName!.substring(0, 1).toUpperCase()
                            : 'G',
                        style: GoogleFonts.outfit(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: AppColors.brandOrange,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      b.guestName ?? 'profile.guest'.tr(),
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
                        bookingStatusLabel(b.status),
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
                  color: const Color(0xFF616161),
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
              if (b.status == BookingStatus.waitingApproval) ...[
                Row(
                  children: [
                    Expanded(
                      child: Semantics(
                        label: 'Onayla',
                        child: FilledButton.icon(
                          onPressed: _busy ? null : () => _approveBooking(b),
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
                          label: Text('partner.approve'.tr()),
                          style: FilledButton.styleFrom(
                            backgroundColor: Colors.green,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Semantics(
                        label: 'Reddet',
                        child: FilledButton.icon(
                          onPressed: _busy ? null : () => _rejectBooking(b),
                          icon: _busy
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.cancel_rounded),
                          label: Text('partner.reject'.tr()),
                          style: FilledButton.styleFrom(
                            backgroundColor: Colors.redAccent,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],

              if (b.status == BookingStatus.paid ||
                  b.status == BookingStatus.approved) ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: Semantics(
                    label: 'Valizleri Teslim Al',
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
                ),
              ],

              if (b.status == BookingStatus.checkedIn) ...[
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: Semantics(
                    label: 'Valizleri Teslim Et',
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
                ),
              ],

              if (b.status == BookingStatus.paid ||
                  b.status == BookingStatus.approved) ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _showBagRevisionSheet(b),
                    icon: const Icon(Icons.edit_note_rounded),
                    label: Text('partner.bag_revision_title'.tr()),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.brandOrange,
                      side: const BorderSide(color: AppColors.brandOrange),
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
                    color: const Color(0xFF424242),
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
            color: const Color(0xFF616161),
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
}

class _BagRevisionBottomSheet extends StatefulWidget {
  final BookingDto booking;
  final Dio dio;

  const _BagRevisionBottomSheet({required this.booking, required this.dio});

  @override
  State<_BagRevisionBottomSheet> createState() =>
      _BagRevisionBottomSheetState();
}

class _BagRevisionBottomSheetState extends State<_BagRevisionBottomSheet> {
  late int _bagCountS;
  late int _bagCountM;
  late int _bagCountXl;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _bagCountS = widget.booking.bagCountS;
    _bagCountM = widget.booking.bagCountM;
    _bagCountXl = widget.booking.bagCountXl;
  }

  Future<void> _submit() async {
    final total = _bagCountS + _bagCountM + _bagCountXl;
    if (total <= 0) {
      return;
    }

    setState(() => _submitting = true);
    try {
      await widget.dio.post(
        '/partner/bookings/${widget.booking.id}/bag-revision',
        data: {
          'bagCountS': _bagCountS,
          'bagCountM': _bagCountM,
          'bagCountXl': _bagCountXl,
        },
      );
      if (mounted) {
        Navigator.pop(context, true);
      }
    } on DioException catch (e) {
      if (mounted) {
        final msg =
            e.response?.data?['error'] ?? 'partner.bag_revision_error'.tr();
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(msg.toString())));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('partner.bag_revision_error'.tr())),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Widget _buildCounterRow(
    String label,
    String description,
    int val,
    ValueChanged<int> onChange,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textDark,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          Row(
            children: [
              IconButton(
                onPressed: val > 0 ? () => onChange(val - 1) : null,
                icon: const Icon(Icons.remove_circle_outline, size: 28),
                color: AppColors.brandOrange,
              ),
              SizedBox(
                width: 40,
                child: Text(
                  '$val',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              IconButton(
                onPressed: () => onChange(val + 1),
                icon: const Icon(Icons.add_circle_outline, size: 28),
                color: AppColors.brandOrange,
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = _bagCountS + _bagCountM + _bagCountXl;
    final isSaveDisabled = _submitting || total <= 0;

    return Container(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'partner.bag_revision_title'.tr(),
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const Divider(),
            const SizedBox(height: 12),
            _buildCounterRow(
              'S (Small)',
              'Cabins / Backpacks',
              _bagCountS,
              (v) => setState(() => _bagCountS = v),
            ),
            _buildCounterRow(
              'M (Medium)',
              'Medium Luggage',
              _bagCountM,
              (v) => setState(() => _bagCountM = v),
            ),
            _buildCounterRow(
              'XL (Extra Large)',
              'Large / Huge Luggage',
              _bagCountXl,
              (v) => setState(() => _bagCountXl = v),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: FilledButton(
                onPressed: isSaveDisabled ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.brandOrange,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.5,
                        ),
                      )
                    : Text(
                        'common.save'.tr(),
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

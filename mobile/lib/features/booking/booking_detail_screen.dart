import 'dart:async' show Timer;
import 'dart:io' show Platform;
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:screen_protector/screen_protector.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/repositories/booking_repository.dart';
import '../../shared/models/booking.dart';
import '../../shared/utils/app_colors.dart';
import '../../shared/utils/booking_helpers.dart';
import '../../shared/widgets/skeleton.dart';

final bookingProvider = FutureProvider.family<BookingDto, String>((
  ref,
  id,
) async {
  final result = await ref.watch(bookingRepositoryProvider).getById(id);
  return result.fold((data) => data, (error) => throw Exception(error));
});

final bookingSealsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, id) async {
      final dio = ref.read(dioProvider);
      final res = await dio.get('/bookings/$id');
      final data = res.data as Map<String, dynamic>;
      final seals = data['seals'] as List<dynamic>? ?? [];
      return seals.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    });

class BookingDetailScreen extends ConsumerStatefulWidget {
  const BookingDetailScreen({required this.bookingId, super.key});
  final String bookingId;

  @override
  ConsumerState<BookingDetailScreen> createState() =>
      _BookingDetailScreenState();
}

class _BookingDetailScreenState extends ConsumerState<BookingDetailScreen> {
  Timer? _pollingTimer;
  bool _cancelling = false;
  bool _modifying = false;

  @override
  void initState() {
    super.initState();
    _protectScreen();
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

  Future<void> _protectScreen() async {
    await ScreenProtector.preventScreenshotOn();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    ScreenProtector.preventScreenshotOff();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bookingAsync = ref.watch(bookingProvider(widget.bookingId));
    final fmt = DateFormat('dd MMMM yyyy, HH:mm');

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'booking.detail_title'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
      ),
      body: bookingAsync.when(
        skipLoadingOnReload: true,
        loading: _buildSkeleton,
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 64,
                color: Colors.redAccent,
              ),
              const SizedBox(height: 16),
              Text('common.error'.tr()),
              TextButton(
                onPressed: () => ref.refresh(bookingProvider(widget.bookingId)),
                child: Text('common.retry'.tr()),
              ),
            ],
          ),
        ),
        data: (bk) => SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              // Ticket Design
              DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
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
                            style: GoogleFonts.outfit(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          _statusBadge(bk.status),
                          if (bk.status == BookingStatus.waitingApproval ||
                              bk.status == BookingStatus.approved) ...[
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.orange.shade50,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: Colors.orange.shade200,
                                ),
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.info_outline_rounded,
                                    color: Colors.orange,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      'booking.pay_at_shop_desc'.tr(),
                                      style: GoogleFonts.outfit(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.orange.shade900,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
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
                              eyeStyle: const QrEyeStyle(
                                eyeShape: QrEyeShape.square,
                                color: AppColors.textDark,
                              ),
                              dataModuleStyle: const QrDataModuleStyle(
                                dataModuleShape: QrDataModuleShape.square,
                                color: AppColors.textDark,
                              ),
                              embeddedImage: const AssetImage(
                                'assets/images/logo.png',
                              ),
                              embeddedImageStyle: const QrEmbeddedImageStyle(
                                size: Size(40, 40),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'booking.qr_hint'.tr(),
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                color: const Color(0xFF616161),
                              ),
                            ),
                            const SizedBox(height: 32),
                          ],
                          _infoRow(
                            'checkout.check_in'.tr(),
                            fmt.format(bk.checkInTime),
                          ),
                          const SizedBox(height: 16),
                          _infoRow(
                            'checkout.check_out'.tr(),
                            fmt.format(bk.checkOutTime),
                          ),
                          const SizedBox(height: 16),
                          _infoRow(
                            'nav.bookings'.tr(),
                            '${bk.totalBags} Adet (S:${bk.bagCountS}, M:${bk.bagCountM}, XL:${bk.bagCountXl})',
                          ),
                          const SizedBox(height: 16),
                          _infoRow(
                            'checkout.total'.tr(),
                            '₺${bk.totalPrice.toStringAsFixed(2)}',
                            isBold: true,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Seals Display
              Consumer(
                builder: (context, ref, _) {
                  final sealsAsync = ref.watch(
                    bookingSealsProvider(widget.bookingId),
                  );
                  return sealsAsync.when(
                    data: (seals) {
                      if (seals.isEmpty) return const SizedBox.shrink();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'booking.seals'.tr(),
                            style: GoogleFonts.outfit(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textDark,
                            ),
                          ),
                          const SizedBox(height: 12),
                          ...seals.map(
                            (seal) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.shield_rounded,
                                    size: 18,
                                    color: AppColors.brandOrange,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    '#${seal['sealNumber'] ?? ''}',
                                    style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.brandOrange.withValues(
                                        alpha: 0.1,
                                      ),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '${seal['bagSize'] ?? ''} #${(seal['bagIndex'] ?? 0) + 1}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 12,
                                        color: AppColors.brandOrange,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],
                      );
                    },
                    loading: () => const SizedBox.shrink(),
                    error: (_, _) => const SizedBox.shrink(),
                  );
                },
              ),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _launchMaps(bk),
                      icon: const Icon(Icons.map_rounded),
                      label: Text('booking.directions'.tr()),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _callShop(bk.shopPhone),
                      icon: const Icon(Icons.phone_rounded),
                      label: Text('booking.call_shop'.tr()),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Cancel / Modify / Dispute / Review
              if (bk.status == BookingStatus.waitingApproval ||
                  bk.status == BookingStatus.approved ||
                  bk.status == BookingStatus.paid) ...[
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _cancelling
                            ? null
                            : () => _cancelBooking(bk),
                        icon: _cancelling
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(
                                Icons.cancel_outlined,
                                color: Colors.redAccent,
                              ),
                        label: Text(
                          'booking.cancel'.tr(),
                          style: const TextStyle(color: Colors.redAccent),
                        ),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          side: const BorderSide(color: Colors.redAccent),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _modifying ? null : () => _modifyBooking(bk),
                        icon: _modifying
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.edit_outlined),
                        label: Text('booking.modify'.tr()),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],

              if (bk.status == BookingStatus.checkedIn ||
                  bk.status == BookingStatus.checkedOut) ...[
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => _showDisputeSheet(bk),
                    icon: const Icon(
                      Icons.warning_amber_rounded,
                      color: Colors.orange,
                    ),
                    label: Text(
                      'booking.file_dispute'.tr(),
                      style: const TextStyle(color: Colors.orange),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      side: const BorderSide(color: Colors.orange),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              if (bk.status == BookingStatus.checkedOut) ...[
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => _showReviewSheet(bk),
                    icon: const Icon(Icons.star_outline_rounded),
                    label: Text('booking.rate_shop'.tr()),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: () => _showCancellationPolicy(context),
                  icon: const Icon(Icons.info_outline_rounded, size: 20),
                  label: Text('booking.cancellation_policy'.tr()),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF424242),
                  ),
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
    final color = bookingStatusColor(status);
    final label = bookingStatusLabel(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Text(
        label,
        style: GoogleFonts.outfit(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 14,
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.outfit(color: const Color(0xFF616161))),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: GoogleFonts.outfit(
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              fontSize: isBold ? 16 : 14,
              color: AppColors.textDark,
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _launchMaps(BookingDto bk) async {
    Uri url;
    if (bk.latitude != null && bk.longitude != null) {
      if (Platform.isIOS) {
        url = Uri.parse(
          'https://maps.apple.com/?q=${bk.shopName}&ll=${bk.latitude},${bk.longitude}',
        );
      } else {
        url = Uri.parse('google.navigation:q=${bk.latitude},${bk.longitude}');
      }
    } else {
      url = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=${bk.shopName}',
      );
    }

    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  Future<void> _callShop(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  Future<void> _cancelBooking(BookingDto bk) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('booking.cancel_title'.tr()),
        content: Text('booking.cancel_confirm'.tr()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('common.cancel'.tr()),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('booking.cancel'.tr()),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _cancelling = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.delete('/bookings/${bk.id}/cancel');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('booking.cancel_success'.tr())));
        ref.invalidate(bookingProvider(widget.bookingId));
      }
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.response?.data?['error'] ?? 'common.error'.tr()),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  Future<void> _modifyBooking(BookingDto bk) async {
    DateTime? newCheckIn = bk.checkInTime;
    DateTime? newCheckOut = bk.checkOutTime;
    var s = bk.bagCountS;
    var m = bk.bagCountM;
    var xl = bk.bagCountXl;

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 24,
            right: 24,
            top: 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'booking.modify_title'.tr(),
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 20),
              ListTile(
                title: Text(
                  'checkout.check_in'.tr(),
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w500),
                ),
                subtitle: Text(
                  DateFormat('dd MMM yyyy, HH:mm').format(newCheckIn!),
                  style: GoogleFonts.outfit(color: AppColors.brandOrange),
                ),
                trailing: const Icon(
                  Icons.calendar_today_rounded,
                  color: AppColors.brandOrange,
                ),
                onTap: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: newCheckIn,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  // Tarih secici acikken sayfa kapatilmis olabilir; `context`
                  // o durumda bayat ve saat secici cokerdi.
                  if (!mounted) return;
                  if (date != null) {
                    final time = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.fromDateTime(newCheckIn!),
                    );
                    if (time != null) {
                      setSheetState(
                        () => newCheckIn = DateTime(
                          date.year,
                          date.month,
                          date.day,
                          time.hour,
                          time.minute,
                        ),
                      );
                    }
                  }
                },
              ),
              ListTile(
                title: Text(
                  'checkout.check_out'.tr(),
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w500),
                ),
                subtitle: Text(
                  DateFormat('dd MMM yyyy, HH:mm').format(newCheckOut!),
                  style: GoogleFonts.outfit(color: AppColors.brandOrange),
                ),
                trailing: const Icon(
                  Icons.calendar_today_rounded,
                  color: AppColors.brandOrange,
                ),
                onTap: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: newCheckOut,
                    firstDate: newCheckIn ?? DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (!mounted) return;
                  if (date != null) {
                    final time = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.fromDateTime(newCheckOut!),
                    );
                    if (time != null) {
                      setSheetState(
                        () => newCheckOut = DateTime(
                          date.year,
                          date.month,
                          date.day,
                          time.hour,
                          time.minute,
                        ),
                      );
                    }
                  }
                },
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  _bagStepper(ctx, 'S', s, (v) => setSheetState(() => s = v)),
                  const SizedBox(width: 12),
                  _bagStepper(ctx, 'M', m, (v) => setSheetState(() => m = v)),
                  const SizedBox(width: 12),
                  _bagStepper(
                    ctx,
                    'XL',
                    xl,
                    (v) => setSheetState(() => xl = v),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, {
                  'checkInTime': newCheckIn!.toUtc().toIso8601String(),
                  'checkOutTime': newCheckOut!.toUtc().toIso8601String(),
                  'bagCountS': s,
                  'bagCountM': m,
                  'bagCountXl': xl,
                }),
                child: Text('booking.modify'.tr()),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
    if (result == null) return;
    setState(() => _modifying = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.put(
        '/bookings/${bk.id}/modify',
        data: {
          'checkInTime': result['checkInTime'],
          'checkOutTime': result['checkOutTime'],
          'bagCountS': result['bagCountS'],
          'bagCountM': result['bagCountM'],
          'bagCountXl': result['bagCountXl'],
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('booking.modified'.tr())));
        ref.invalidate(bookingProvider(widget.bookingId));
      }
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.response?.data?['error'] ?? 'common.error'.tr()),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _modifying = false);
    }
  }

  Widget _bagStepper(
    BuildContext ctx,
    String label,
    int val,
    void Function(int) onChanged,
  ) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.remove_circle_outline),
                onPressed: val > 0 ? () => onChanged(val - 1) : null,
              ),
              Text(
                '$val',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline),
                onPressed: () => onChanged(val + 1),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _showReviewSheet(BookingDto bk) async {
    var rating = 5;
    var submitting = false;
    final commentCtl = TextEditingController();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
          left: 24,
          right: 24,
          top: 24,
        ),
        child: StatefulBuilder(
          builder: (ctx, setSheetState) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'booking.rate_shop'.tr(),
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  5,
                  (i) => IconButton(
                    icon: Icon(
                      i < rating
                          ? Icons.star_rounded
                          : Icons.star_outline_rounded,
                      size: 40,
                      color: Colors.amber,
                    ),
                    onPressed: () => setSheetState(() => rating = i + 1),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: commentCtl,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'booking.review_comment'.tr(),
                ),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: submitting
                    ? null
                    : () async {
                        setSheetState(() => submitting = true);
                        try {
                          final dio = ref.read(dioProvider);
                          await dio.post(
                            '/reviews',
                            data: {
                              'bookingId': bk.id,
                              'rating': rating,
                              'comment': commentCtl.text,
                            },
                          );
                          // `ctx` alt panelin, `context` sayfanin. Panel kapandiktan
                          // sonra da bildirim SAYFANIN uzerinde gorunmeli, o yuzden
                          // ikisi AYRI korunuyor -- eskiden `ctx.mounted` ile korunup
                          // `context` kullaniliyordu, yani yanlis olcut.
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('booking.review_success'.tr()),
                              ),
                            );
                          }
                        } catch (_) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('common.error'.tr())),
                            );
                          }
                        } finally {
                          if (ctx.mounted) {
                            setSheetState(() => submitting = false);
                          }
                        }
                      },
                child: submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text('booking.submit_review'.tr()),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showDisputeSheet(BookingDto bk) async {
    final descCtl = TextEditingController();
    var reason = 'DAMAGE';
    var submitting = false;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
          left: 24,
          right: 24,
          top: 24,
        ),
        child: StatefulBuilder(
          builder: (ctx, setSheetState) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'booking.dispute_title'.tr(),
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 20),
              DropdownButtonFormField<String>(
                initialValue: reason,
                items: [
                  DropdownMenuItem(
                    value: 'DAMAGE',
                    child: Text('booking.dispute_damage'.tr()),
                  ),
                  DropdownMenuItem(
                    value: 'THEFT',
                    child: Text('booking.dispute_theft'.tr()),
                  ),
                  DropdownMenuItem(
                    value: 'OTHER',
                    child: Text('booking.dispute_other'.tr()),
                  ),
                ],
                onChanged: (v) => setSheetState(() => reason = v ?? 'DAMAGE'),
                decoration: InputDecoration(
                  labelText: 'booking.dispute_reason'.tr(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descCtl,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: 'booking.dispute_description'.tr(),
                ),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: submitting
                    ? null
                    : () async {
                        if (descCtl.text.length < 10) return;
                        setSheetState(() => submitting = true);
                        try {
                          final dio = ref.read(dioProvider);
                          await dio.post(
                            '/disputes',
                            data: {
                              'bookingId': bk.id,
                              'reason': reason,
                              'description': descCtl.text,
                            },
                          );
                          // `ctx` alt panelin, `context` sayfanin. Panel kapandiktan
                          // sonra da bildirim SAYFANIN uzerinde gorunmeli, o yuzden
                          // ikisi AYRI korunuyor -- eskiden `ctx.mounted` ile korunup
                          // `context` kullaniliyordu, yani yanlis olcut.
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('booking.dispute_success'.tr()),
                              ),
                            );
                          }
                        } catch (_) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('common.error'.tr())),
                            );
                          }
                        } finally {
                          if (ctx.mounted) {
                            setSheetState(() => submitting = false);
                          }
                        }
                      },
                child: submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text('booking.submit_dispute'.tr()),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  void _showCancellationPolicy(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'booking.cancellation_policy'.tr(),
              style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'booking.cancel_tier1'.tr(),
              style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
            ),
            Text('booking.cancel_tier1_desc'.tr()),
            const SizedBox(height: 12),
            Text(
              'booking.cancel_tier2'.tr(),
              style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
            ),
            Text('booking.cancel_tier2_desc'.tr()),
            const SizedBox(height: 12),
            Text(
              'booking.cancel_tier3'.tr(),
              style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
            ),
            Text('booking.cancel_tier3_desc'.tr()),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('common.close'.tr()),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSkeleton() {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(24),
      child: Column(
        children: [
          Skeleton(height: 400, width: double.infinity, borderRadius: 24),
          SizedBox(height: 32),
          Row(
            children: [
              Expanded(child: Skeleton(height: 56, borderRadius: 16)),
              SizedBox(width: 16),
              Expanded(child: Skeleton(height: 56, borderRadius: 16)),
            ],
          ),
        ],
      ),
    );
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

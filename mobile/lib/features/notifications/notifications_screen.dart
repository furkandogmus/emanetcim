import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/services/haptic_service.dart';
import '../../core/services/notification_service.dart';
import '../../shared/models/notification.dart';
import '../../shared/utils/app_colors.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'notifications.title'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        actions: [
          if (notifications.isNotEmpty)
            TextButton(
              onPressed: () {
                ref.read(hapticServiceProvider).success();
                ref.read(notificationProvider.notifier).markAllAsRead();
              },
              child: Text(
                'notifications.mark_all_read'.tr(),
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppColors.brandOrange,
                ),
              ),
            ),
        ],
      ),
      body: notifications.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Colors.grey.withValues(alpha: 0.05),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.notifications_off_outlined,
                      size: 64,
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'notifications.empty'.tr(),
                    style: GoogleFonts.outfit(
                      color: Colors.grey.shade500,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(20),
              itemCount: notifications.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final n = notifications[index];
                return _notificationTile(context, n);
              },
            ),
    );
  }

  Widget _notificationTile(BuildContext context, NotificationDto n) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: n.isRead
                ? Colors.black.withValues(alpha: 0.02)
                : const Color(0xFFF97316).withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(
          color: n.isRead
              ? Colors.grey.shade100
              : const Color(0xFFF97316).withValues(alpha: 0.1),
          width: 1.5,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: HapticFeedback.lightImpact,
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _typeColor(n.type).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    _typeIcon(n.type),
                    color: _typeColor(n.type),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              n.title,
                              style: GoogleFonts.outfit(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                          ),
                          if (!n.isRead)
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: Color(0xFFF97316),
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        n.body,
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          color: Colors.grey.shade600,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _formatTime(n.createdAt),
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: Colors.grey.shade400,
                          fontWeight: FontWeight.w500,
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
  }

  IconData _typeIcon(NotificationType type) {
    switch (type) {
      case NotificationType.bookingUpdate:
        return Icons.luggage_rounded;
      case NotificationType.paymentSuccess:
        return Icons.check_circle_rounded;
      case NotificationType.shopApplication:
        return Icons.store_rounded;
      case NotificationType.campaign:
        return Icons.local_offer_rounded;
      case NotificationType.dispute:
        return Icons.gavel_rounded;
      case NotificationType.info:
        return Icons.info_rounded;
    }
  }

  Color _typeColor(NotificationType type) {
    switch (type) {
      case NotificationType.bookingUpdate:
        return const Color(0xFF3B82F6);
      case NotificationType.paymentSuccess:
        return const Color(0xFF10B981);
      case NotificationType.shopApplication:
        return const Color(0xFFF97316);
      case NotificationType.campaign:
        return const Color(0xFF8B5CF6);
      case NotificationType.dispute:
        return const Color(0xFFEF4444);
      case NotificationType.info:
        return const Color(0xFF64748B);
    }
  }

  String _formatTime(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inMinutes < 60) return '${diff.inMinutes} dk önce';
    if (diff.inHours < 24) return '${diff.inHours} sa önce';
    return DateFormat('dd MMM, HH:mm').format(date);
  }
}

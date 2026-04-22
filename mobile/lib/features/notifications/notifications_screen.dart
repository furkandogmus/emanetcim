import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../shared/models/notification.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Mock data for now, would come from a provider
    final List<NotificationDto> mockNotifications = [
      NotificationDto(
        id: '1',
        title: 'Ödeme Başarılı',
        body:
            'Rezervasyon ödemeniz başarıyla alındı. Valizlerinizi teslim edebilirsiniz.',
        type: NotificationType.paymentSuccess,
        createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
        isRead: false,
      ),
      NotificationDto(
        id: '2',
        title: 'Dükkan Onaylandı',
        body:
            'Dükkan başvurunuz yönetici tarafından onaylandı. Artık müşteri kabul edebilirsiniz.',
        type: NotificationType.shopApplication,
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
        isRead: true,
      ),
      NotificationDto(
        id: '3',
        title: 'Yeni Kampanya!',
        body:
            'İstanbul genelinde tüm emanet noktalarında %20 indirim fırsatını kaçırmayın.',
        type: NotificationType.campaign,
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
        isRead: false,
      ),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'notifications.title'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        actions: [
          TextButton(
            onPressed: () {},
            child: Text(
              'notifications.mark_all_read'.tr(),
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
      body: mockNotifications.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.notifications_off_outlined,
                    size: 64,
                    color: Colors.grey,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'notifications.empty'.tr(),
                    style: GoogleFonts.outfit(color: Colors.grey),
                  ),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(20),
              itemCount: mockNotifications.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final n = mockNotifications[index];
                return _notificationTile(context, n);
              },
            ),
    );
  }

  Widget _notificationTile(BuildContext context, NotificationDto n) {
    return Container(
      decoration: BoxDecoration(
        color: n.isRead
            ? Colors.white
            : Colors.orange.shade50.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: n.isRead
              ? Colors.transparent
              : const Color(0xFFF97316).withValues(alpha: 0.2),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
          ),
        ],
      ),
      child: ListTile(
        onTap: () {
          HapticFeedback.lightImpact();
          // Navigate to deepLink if exists
        },
        contentPadding: const EdgeInsets.all(16),
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: _typeColor(n.type).withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(_typeIcon(n.type), color: _typeColor(n.type), size: 24),
        ),
        title: Row(
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
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              n.body,
              style: GoogleFonts.outfit(
                fontSize: 14,
                color: Colors.grey.shade600,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _formatTime(n.createdAt),
              style: GoogleFonts.outfit(
                fontSize: 11,
                color: Colors.grey.shade400,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
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

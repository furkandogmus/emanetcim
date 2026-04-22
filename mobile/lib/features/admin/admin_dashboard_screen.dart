import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'admin.dashboard'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Stats Grid
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            childAspectRatio: 1.3,
            children: [
              _statCard(
                context,
                'admin.total_bookings'.tr(),
                '1,248',
                Icons.work_rounded,
                const Color(0xFF0F172A),
              ),
              _statCard(
                context,
                'admin.total_revenue'.tr(),
                '₺42,500',
                Icons.account_balance_wallet_rounded,
                const Color(0xFFF97316),
                isOrange: true,
              ),
              _statCard(
                context,
                'admin.active_partners'.tr(),
                '84',
                Icons.store_rounded,
                const Color(0xFF3B82F6),
              ),
              _statCard(
                context,
                'admin.pending_apps'.tr(),
                '12',
                Icons.pending_actions_rounded,
                const Color(0xFFEF4444),
              ),
            ],
          ),

          const SizedBox(height: 32),

          // Live Analytics Placeholder
          Text(
            'admin.live_analytics'.tr().toUpperCase(),
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade500,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 20,
                ),
              ],
            ),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.analytics_rounded,
                    size: 48,
                    color: Colors.grey,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Grafikler yakında burada olacak',
                    style: GoogleFonts.outfit(color: Colors.grey),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 32),

          // Quick Actions
          Text(
            'admin.quick_actions'.tr().toUpperCase(),
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade500,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 12),
          _actionTile(
            Icons.verified_user_rounded,
            'admin.approve_shops'.tr(),
            '12 yeni dükkan başvurusu',
            const Color(0xFFF97316),
            onTap: () => context.push('/admin/applications'),
          ),
          _actionTile(
            Icons.health_and_safety_rounded,
            'admin.system_status'.tr(),
            'Tüm sistemler aktif',
            const Color(0xFF10B981),
            isPulse: true,
            onTap: () {},
          ),
          _actionTile(
            Icons.message_rounded,
            'Destek Mesajları',
            '5 okunmamış mesaj',
            const Color(0xFF3B82F6),
            onTap: () {},
          ),
        ],
      ),
    );
  }

  Widget _statCard(
    BuildContext context,
    String title,
    String value,
    IconData icon,
    Color color, {
    bool isOrange = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 10),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF0F172A),
                ),
              ),
              Text(
                title,
                style: GoogleFonts.outfit(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade500,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _actionTile(
    IconData icon,
    String title,
    String subtitle,
    Color color, {
    bool isPulse = false,
    VoidCallback? onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap?.call();
        },
        tileColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(icon, color: color),
        ),
        title: Text(
          title,
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        subtitle: Text(
          subtitle,
          style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey.shade600),
        ),
        trailing: isPulse
            ? Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFF10B981),
                  shape: BoxShape.circle,
                ),
              )
            : const Icon(
                Icons.arrow_forward_ios_rounded,
                size: 14,
                color: Colors.grey,
              ),
      ),
    );
  }
}

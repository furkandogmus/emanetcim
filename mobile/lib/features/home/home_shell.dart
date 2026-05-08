import 'dart:ui';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/models/user.dart';
import '../../shared/utils/app_colors.dart';

class HomeShell extends ConsumerWidget {
  const HomeShell({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role =
        ref.watch(authControllerProvider).session?.role ?? UserRole.guest;
    final loc = GoRouterState.of(context).matchedLocation;

    var tabs = <_TabItem>[];

    if (role == UserRole.admin) {
      tabs = [
        _TabItem(
          icon: Icons.dashboard_outlined,
          activeIcon: Icons.dashboard_rounded,
          label: 'admin.dashboard'.tr(),
          path: '/admin',
        ),
        _TabItem(
          icon: Icons.notifications_none_rounded,
          activeIcon: Icons.notifications_rounded,
          label: 'notifications.title'.tr(),
          path: '/notifications',
        ),
        _TabItem(
          icon: Icons.person_outline_rounded,
          activeIcon: Icons.person_rounded,
          label: 'nav.profile'.tr(),
          path: '/profile',
        ),
      ];
    } else if (role == UserRole.partner) {
      tabs = [
        _TabItem(
          icon: Icons.luggage_outlined,
          activeIcon: Icons.luggage,
          label: 'nav.bookings'.tr(),
          path: '/partner',
        ),
        _TabItem(
          icon: Icons.qr_code_scanner_rounded,
          activeIcon: Icons.qr_code_scanner_rounded,
          label: 'nav.scan'.tr(),
          path: '/partner/scan',
          isFab: true,
        ),
        _TabItem(
          icon: Icons.notifications_none_rounded,
          activeIcon: Icons.notifications_rounded,
          label: 'notifications.title'.tr(),
          path: '/notifications',
        ),
        _TabItem(
          icon: Icons.person_outline_rounded,
          activeIcon: Icons.person_rounded,
          label: 'nav.profile'.tr(),
          path: '/profile',
        ),
      ];
    } else {
      tabs = [
        _TabItem(
          icon: Icons.home_outlined,
          activeIcon: Icons.home_rounded,
          label: 'nav.home'.tr(),
          path: '/',
        ),
        _TabItem(
          icon: Icons.search_outlined,
          activeIcon: Icons.search_rounded,
          label: 'nav.search'.tr(),
          path: '/search',
        ),
        _TabItem(
          icon: Icons.luggage_outlined,
          activeIcon: Icons.luggage,
          label: 'nav.bookings'.tr(),
          path: '/bookings',
        ),
        _TabItem(
          icon: Icons.notifications_none_rounded,
          activeIcon: Icons.notifications_rounded,
          label: 'notifications.title'.tr(),
          path: '/notifications',
        ),
        _TabItem(
          icon: Icons.person_outline_rounded,
          activeIcon: Icons.person_rounded,
          label: 'nav.profile'.tr(),
          path: '/profile',
        ),
      ];
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      extendBody: true,
      body: child,
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        height: 72,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 30,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: tabs
                  .map(
                    (t) => _NavItem(
                      item: t,
                      isSelected: loc == t.path,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        if (t.isFab) {
                          context.push(t.path);
                        } else {
                          context.go(t.path);
                        }
                      },
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      ),
    );
  }
}

class _TabItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String path;
  final bool isFab;

  _TabItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.path,
    this.isFab = false,
  });
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.item,
    required this.isSelected,
    required this.onTap,
  });

  final _TabItem item;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isSelected ? item.activeIcon : item.icon,
              color: isSelected ? AppColors.brandOrange : Colors.grey.shade400,
              size: 26,
            ),
            const SizedBox(height: 4),
            Text(
              item.label,
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected
                    ? AppColors.brandOrange
                    : Colors.grey.shade400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

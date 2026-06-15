import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/models/user.dart';

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
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex(tabs, loc),
        onDestinationSelected: (index) {
          HapticFeedback.lightImpact();
          final tab = tabs[index];
          if (tab.isFab) {
            context.push(tab.path);
          } else {
            context.go(tab.path);
          }
        },
        destinations: tabs
            .map(
              (tab) => NavigationDestination(
                icon: Icon(tab.icon),
                selectedIcon: Icon(tab.activeIcon),
                label: tab.label,
              ),
            )
            .toList(),
      ),
    );
  }

  int _selectedIndex(List<_TabItem> tabs, String location) {
    final index = tabs.indexWhere(
      (tab) => tab.path == '/'
          ? location == '/'
          : location == tab.path || location.startsWith('${tab.path}/'),
    );
    return index < 0 ? 0 : index;
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

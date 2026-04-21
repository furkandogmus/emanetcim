import 'dart:ui';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/models/user.dart';

class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.child});
  final Widget child;

  int _indexFor(String loc, bool isPartner) {
    if (loc.startsWith('/bookings')) return 1;
    if (loc.startsWith('/partner')) return 2;
    if (loc.startsWith('/profile')) return isPartner ? 3 : 2;
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(authControllerProvider).session?.role;
    final isPartner = role == UserRole.PARTNER;
    final loc = GoRouterState.of(context).matchedLocation;
    final idx = _indexFor(loc, isPartner);
    final theme = Theme.of(context);

    return Scaffold(
      extendBody: true, // Floating nav bar için önemli
      body: child,
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        height: 72,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.9),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
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
              children: [
                if (!isPartner) ...[
                  _NavItem(
                    icon: Icons.explore_outlined,
                    activeIcon: Icons.explore,
                    label: 'nav.search'.tr(),
                    isSelected: idx == 0,
                    onTap: () => context.go('/'),
                  ),
                  _NavItem(
                    icon: Icons.luggage_outlined,
                    activeIcon: Icons.luggage,
                    label: 'nav.bookings'.tr(),
                    isSelected: idx == 1,
                    onTap: () => context.go('/bookings'),
                  ),
                ] else ...[
                  _NavItem(
                    icon: Icons.dashboard_outlined,
                    activeIcon: Icons.dashboard_rounded,
                    label: 'Dashboard',
                    isSelected: idx == 2,
                    onTap: () => context.go('/partner'),
                  ),
                  _NavItem(
                    icon: Icons.qr_code_scanner_rounded,
                    activeIcon: Icons.qr_code_scanner_rounded,
                    label: 'QR Tarat',
                    isSelected: false,
                    onTap: () => context.push('/partner/scan'),
                  ),
                ],
                _NavItem(
                  icon: Icons.person_outline_rounded,
                  activeIcon: Icons.person_rounded,
                  label: 'nav.profile'.tr(),
                  isSelected: isPartner ? idx == 3 : idx == 2,
                  onTap: () => context.go('/profile'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isSelected ? activeIcon : icon,
              color: isSelected ? const Color(0xFFF97316) : Colors.grey.shade400,
              size: 26,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? const Color(0xFFF97316) : Colors.grey.shade400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

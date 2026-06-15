import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/services/analytics_service.dart';
import '../../shared/utils/app_colors.dart';
import '../../shared/widgets/how_it_works_sheet.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _didLogScreen = false;

  @override
  Widget build(BuildContext context) {
    if (!_didLogScreen) {
      _didLogScreen = true;
      ref.read(analyticsServiceProvider).logScreenView('Home');
    }

    final user = ref.watch(authControllerProvider).session;
    final firstName = user?.name?.trim().split(' ').first;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
              sliver: SliverList.list(
                children: [
                  _HomeHeader(
                    greeting: firstName != null && firstName.isNotEmpty
                        ? 'home.greeting'.tr(args: [firstName])
                        : 'home.greeting_guest'.tr(),
                  ),
                  const SizedBox(height: 24),
                  _SearchHero(onTap: () => context.push('/search')),
                  const SizedBox(height: 16),
                  const _TrustStrip(),
                  const SizedBox(height: 32),
                  _SectionHeader(title: 'home.popular_cities'.tr()),
                  const SizedBox(height: 14),
                  SizedBox(
                    height: 106,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _CityCard(
                          name: 'home.city_istanbul'.tr(),
                          icon: Icons.mosque_rounded,
                          color: const Color(0xFF2563EB),
                          onTap: () => context.push('/search'),
                        ),
                        _CityCard(
                          name: 'home.city_ankara'.tr(),
                          icon: Icons.account_balance_rounded,
                          color: const Color(0xFF7C3AED),
                          onTap: () => context.push('/search'),
                        ),
                        _CityCard(
                          name: 'home.city_izmir'.tr(),
                          icon: Icons.sailing_rounded,
                          color: const Color(0xFF0891B2),
                          onTap: () => context.push('/search'),
                        ),
                        _CityCard(
                          name: 'home.city_antalya'.tr(),
                          icon: Icons.wb_sunny_rounded,
                          color: const Color(0xFFD97706),
                          onTap: () => context.push('/search'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                  _SectionHeader(
                    title: 'home.how_it_works'.tr(),
                    action: 'common.see_details'.tr(),
                    onAction: () => _showHowItWorks(context),
                  ),
                  const SizedBox(height: 14),
                  _HowItWorksCard(onTap: () => _showHowItWorks(context)),
                  const SizedBox(height: 20),
                  _SafetyCard(onTap: () => _showHowItWorks(context)),
                ],
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
      builder: (context) => const HowItWorksSheet(),
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.greeting});

  final String greeting;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppColors.brandOrange,
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(Icons.luggage_rounded, color: Colors.white),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'BagajPark',
                style: GoogleFonts.outfit(
                  color: AppColors.brandOrange,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                greeting,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.outfit(
                  color: AppColors.textDark,
                  fontSize: 21,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SearchHero extends StatelessWidget {
  const _SearchHero({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.brandOrange, AppColors.brandOrangeDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: AppColors.brandOrange.withValues(alpha: 0.24),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -18,
            top: -28,
            child: Icon(
              Icons.luggage_rounded,
              size: 150,
              color: Colors.white.withValues(alpha: 0.12),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'home.hero_title'.tr(),
                style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontSize: 27,
                  height: 1.08,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.6,
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: 250,
                child: Text(
                  'home.hero_subtitle'.tr(),
                  style: GoogleFonts.outfit(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 14,
                    height: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: 22),
              FilledButton.icon(
                onPressed: onTap,
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.brandOrangeDark,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 14,
                  ),
                ),
                icon: const Icon(Icons.location_searching_rounded, size: 20),
                label: Text('home.hero_cta'.tr()),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TrustStrip extends StatelessWidget {
  const _TrustStrip();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(
          child: _TrustItem(
            icon: Icons.verified_user_rounded,
            label: 'Doğrulanmış',
          ),
        ),
        SizedBox(width: 8),
        Expanded(
          child: _TrustItem(icon: Icons.lock_rounded, label: 'Mühürlü'),
        ),
        SizedBox(width: 8),
        Expanded(
          child: _TrustItem(icon: Icons.bolt_rounded, label: 'Hızlı'),
        ),
      ],
    );
  }
}

class _TrustItem extends StatelessWidget {
  const _TrustItem({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 11),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 17, color: AppColors.brandOrange),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    this.action,
    this.onAction,
  });

  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
        ),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!)),
      ],
    );
  }
}

class _CityCard extends StatelessWidget {
  const _CityCard({
    required this.name,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String name;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          width: 112,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.09),
            border: Border.all(color: color.withValues(alpha: 0.18)),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 28),
              Text(
                name,
                style: GoogleFonts.outfit(
                  color: AppColors.textDark,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HowItWorksCard extends StatelessWidget {
  const _HowItWorksCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Ink(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          children: [
            _StepIcon(icon: Icons.search_rounded, number: '1'),
            const Expanded(child: Divider(color: AppColors.border)),
            _StepIcon(icon: Icons.qr_code_rounded, number: '2'),
            const Expanded(child: Divider(color: AppColors.border)),
            _StepIcon(icon: Icons.explore_rounded, number: '3'),
          ],
        ),
      ),
    );
  }
}

class _StepIcon extends StatelessWidget {
  const _StepIcon({required this.icon, required this.number});

  final IconData icon;
  final String number;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppColors.brandOrange.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(icon, color: AppColors.brandOrange),
        ),
        const SizedBox(height: 7),
        Text(
          number,
          style: GoogleFonts.outfit(
            color: AppColors.textSecondary,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _SafetyCard extends StatelessWidget {
  const _SafetyCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Ink(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          border: Border.all(color: const Color(0xFFBFDBFE)),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.shield_rounded,
                color: Color(0xFF2563EB),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'home.safety_title'.tr(),
                    style: GoogleFonts.outfit(
                      color: AppColors.textDark,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'home.safety_desc'.tr(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      color: const Color(0xFF1D4ED8),
                      fontSize: 12,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF2563EB)),
          ],
        ),
      ),
    );
  }
}

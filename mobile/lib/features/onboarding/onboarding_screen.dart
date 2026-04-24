import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_controller.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final PageController _controller = PageController();
  int _currentPage = 0;

  final List<OnboardingData> _pages = [
    OnboardingData(
      title: 'onboarding.step1.title',
      desc: 'onboarding.step1.desc',
      image:
          'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=800&auto=format&fit=crop',
      color: const Color(0xFFF97316),
    ),
    OnboardingData(
      title: 'onboarding.step2.title',
      desc: 'onboarding.step2.desc',
      image:
          'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=800&auto=format&fit=crop',
      color: const Color(0xFF3B82F6),
    ),
    OnboardingData(
      title: 'onboarding.step3.title',
      desc: 'onboarding.step3.desc',
      image:
          'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=800&auto=format&fit=crop',
      color: const Color(0xFF10B981),
    ),
    OnboardingData(
      title: 'onboarding.step4.title',
      desc: 'onboarding.step4.desc',
      image:
          'https://images.unsplash.com/photo-1551524164-687a5591103e?q=80&w=800&auto=format&fit=crop',
      color: const Color(0xFF8B5CF6),
    ),
  ];

  Future<void> _completeOnboarding() async {
    await ref.read(authControllerProvider.notifier).setOnboardingDone();
    if (mounted) context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: _pages.length,
            onPageChanged: (idx) => setState(() => _currentPage = idx),
            itemBuilder: (context, idx) {
              final p = _pages[idx];
              return Container(
                decoration: BoxDecoration(
                  image: DecorationImage(
                    image: NetworkImage(p.image),
                    fit: BoxFit.cover,
                    colorFilter: ColorFilter.mode(
                      Colors.black.withValues(alpha: 0.5),
                      BlendMode.darken,
                    ),
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 40,
                      vertical: 60,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.title.tr(),
                          style: GoogleFonts.outfit(
                            fontSize: 36,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          p.desc.tr(),
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            color: Colors.white.withValues(alpha: 0.9),
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 120),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          Positioned(
            bottom: 60,
            left: 40,
            right: 40,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: List.generate(
                    _pages.length,
                    (idx) => AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      margin: const EdgeInsets.only(right: 8),
                      height: 6,
                      width: _currentPage == idx ? 24 : 6,
                      decoration: BoxDecoration(
                        color: _currentPage == idx
                            ? const Color(0xFFF97316)
                            : Colors.white24,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                ),
                if (_currentPage == _pages.length - 1)
                  ElevatedButton(
                    onPressed: _completeOnboarding,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFF97316),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 32,
                        vertical: 16,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 0,
                    ),
                    child: Text(
                      'common.done'.tr(),
                      style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
                    ),
                  )
                else
                  IconButton(
                    onPressed: () => _controller.nextPage(
                      duration: const Duration(milliseconds: 500),
                      curve: Curves.easeInOut,
                    ),
                    icon: const Icon(
                      Icons.arrow_forward_rounded,
                      color: Colors.white,
                      size: 32,
                    ),
                  ),
              ],
            ),
          ),
          Positioned(
            top: 60,
            right: 20,
            child: TextButton(
              onPressed: _completeOnboarding,
              child: Text(
                'auth.skip'.tr(),
                style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class OnboardingData {
  final String title;
  final String desc;
  final String image;
  final Color color;

  OnboardingData({
    required this.title,
    required this.desc,
    required this.image,
    required this.color,
  });
}

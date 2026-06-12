import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/app_colors.dart';

enum HowItWorksMode { guest, partner }

class HowItWorksSheet extends StatefulWidget {
  const HowItWorksSheet({super.key, this.mode = HowItWorksMode.guest});
  final HowItWorksMode mode;

  @override
  State<HowItWorksSheet> createState() => _HowItWorksSheetState();
}

class _HowItWorksSheetState extends State<HowItWorksSheet> {
  final _controller = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isGuest = widget.mode == HowItWorksMode.guest;
    final prefix = isGuest ? 'tutorial.guest' : 'tutorial.partner';

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade200,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            isGuest ? 'Misafir Rehberi' : 'Esnaf Rehberi',
            style: GoogleFonts.outfit(
              color: const Color(0xFF757575),
              fontWeight: FontWeight.w600,
              fontSize: 12,
              letterSpacing: 1.2,
            ),
          ),
          Expanded(
            child: PageView(
              controller: _controller,
              onPageChanged: (v) => setState(() => _currentPage = v),
              children: [
                _tutorialPage(
                  isGuest
                      ? Icons.search_rounded
                      : Icons.qr_code_scanner_rounded,
                  '$prefix.step1.title'.tr(),
                  '$prefix.step1.desc'.tr(),
                  AppColors.brandOrange,
                ),
                _tutorialPage(
                  isGuest
                      ? Icons.event_available_rounded
                      : Icons.task_alt_rounded,
                  '$prefix.step2.title'.tr(),
                  '$prefix.step2.desc'.tr(),
                  const Color(0xFF10B981),
                ),
                _tutorialPage(
                  isGuest
                      ? Icons.qr_code_2_rounded
                      : Icons.lock_outline_rounded,
                  '$prefix.step3.title'.tr(),
                  '$prefix.step3.desc'.tr(),
                  const Color(0xFF3B82F6),
                ),
                _tutorialPage(
                  isGuest ? Icons.explore_rounded : Icons.payments_outlined,
                  '$prefix.step4.title'.tr(),
                  '$prefix.step4.desc'.tr(),
                  const Color(0xFF8B5CF6),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24.0),
            child: Row(
              children: [
                Row(
                  children: List.generate(4, (index) {
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      margin: const EdgeInsets.only(right: 8),
                      width: _currentPage == index ? 24 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: _currentPage == index
                            ? AppColors.brandOrange
                            : Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    );
                  }),
                ),
                const Spacer(),
                FilledButton(
                  onPressed: () {
                    if (_currentPage < 3) {
                      _controller.nextPage(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      );
                    } else {
                      Navigator.pop(context);
                    }
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(_currentPage < 3 ? 'Devam Et' : 'Başlayalım!'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _tutorialPage(IconData icon, String title, String desc, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 80, color: color),
          ),
          const SizedBox(height: 48),
          Text(
            title,
            style: GoogleFonts.outfit(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0F172A),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            desc,
            style: GoogleFonts.outfit(
              fontSize: 16,
              color: const Color(0xFF424242),
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

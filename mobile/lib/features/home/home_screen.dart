import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_controller.dart';
import '../search/search_screen.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).session;
    final theme = Theme.of(context);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 120,
            floating: true,
            pinned: true,
            backgroundColor: Colors.white,
            elevation: 0,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              title: Text(
                user?.name != null
                    ? 'home.greeting'.tr(args: [user!.name!.split(' ')[0]])
                    : 'home.greeting_guest'.tr(),
                style: GoogleFonts.outfit(
                  color: const Color(0xFF0F172A),
                  fontWeight: FontWeight.bold,
                  fontSize: 20,
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Hero Section
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFF97316), Color(0xFFEA580C)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFF97316).withValues(alpha: 0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'home.hero_title'.tr(),
                          style: GoogleFonts.outfit(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'home.hero_subtitle'.tr(),
                          style: GoogleFonts.outfit(
                            color: Colors.white.withValues(alpha: 0.9),
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: () => context.push('/search'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFFF97316),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 24, vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: Text('home.hero_cta'.tr()),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Popular Cities
                  _sectionHeader('home.popular_cities'.tr()),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 120,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _cityCard('İstanbul', 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=400&auto=format&fit=crop'),
                        _cityCard('Ankara', 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?q=80&w=400&auto=format&fit=crop'),
                        _cityCard('İzmir', 'https://images.unsplash.com/photo-1596464875936-398327918f3a?q=80&w=400&auto=format&fit=crop'),
                        _cityCard('Antalya', 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=400&auto=format&fit=crop'),
                      ],
                    ),
                  ),

                  const SizedBox(height: 40),

                  // How it works
                  _sectionHeader('home.how_it_works'.tr()),
                  const SizedBox(height: 20),
                  _buildStep(
                    context,
                    Icons.search_rounded,
                    'home.step_1_title'.tr(),
                    'home.step_1_desc'.tr(),
                  ),
                  _buildStep(
                    context,
                    Icons.qr_code_rounded,
                    'home.step_2_title'.tr(),
                    'home.step_2_desc'.tr(),
                  ),
                  _buildStep(
                    context,
                    Icons.explore_rounded,
                    'home.step_3_title'.tr(),
                    'home.step_3_desc'.tr(),
                  ),

                  const SizedBox(height: 40),

                  // Promotion Section
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.blue.shade100),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.shield_outlined,
                            size: 40, color: Colors.blue.shade700),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'home.safety_title'.tr(),
                                style: GoogleFonts.outfit(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.blue.shade900,
                                ),
                              ),
                              Text(
                                'home.safety_desc'.tr(),
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  color: Colors.blue.shade700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 120),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Text(
      title,
      style: GoogleFonts.outfit(
        fontSize: 20,
        fontWeight: FontWeight.bold,
        color: const Color(0xFF0F172A),
      ),
    );
  }

  Widget _cityCard(String name, String imageUrl) {
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: Container(
        width: 140,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          image: DecorationImage(
            image: NetworkImage(imageUrl),
            fit: BoxFit.cover,
            colorFilter: ColorFilter.mode(
              Colors.black.withValues(alpha: 0.3),
              BlendMode.darken,
            ),
          ),
        ),
        child: Center(
          child: Text(
            name,
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStep(BuildContext context, IconData icon, String title, String desc) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                ),
              ],
            ),
            child: Icon(icon, color: const Color(0xFFF97316)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Text(
                  desc,
                  style: GoogleFonts.outfit(
                    color: Colors.grey.shade600,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

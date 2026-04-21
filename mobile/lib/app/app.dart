import 'dart:ui';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/auth/auth_controller.dart';
import '../core/sync/sync_service.dart';
import '../shared/models/user.dart';
import 'package:screen_protector/screen_protector.dart';
import 'router.dart';
import 'theme.dart';

class BagajParkApp extends ConsumerStatefulWidget {
  const BagajParkApp({super.key});
  @override
  ConsumerState<BagajParkApp> createState() => _BagajParkAppState();
}

class _BagajParkAppState extends ConsumerState<BagajParkApp> with WidgetsBindingObserver {
  bool _isInBackground = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    setState(() {
      _isInBackground = state == AppLifecycleState.inactive || state == AppLifecycleState.paused;
    });
  }

  void _updateScreenProtection(UserDto? user) {
    if (user?.role == UserRole.PARTNER) {
      ScreenProtector.preventScreenshotOn();
    } else {
      // Per-screen protection will turn this back on if needed
      ScreenProtector.preventScreenshotOff();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final router = ref.watch(routerProvider);
    
    // Security Hardening: Global protection for Partners
    _updateScreenProtection(auth.session);

    // Trigger offline sync on app start
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(syncServiceProvider).sync();
    });

    return MaterialApp.router(
      title: 'BagajPark',
      debugShowCheckedModeBanner: false,
      theme: buildLightTheme(),
      darkTheme: buildDarkTheme(),
      themeMode: ThemeMode.system,
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      routerConfig: router,
      builder: (context, child) {
        return Stack(
          children: [
            if (child != null) child,
            if (_isInBackground)
              Positioned.fill(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    color: const Color(0xFFF97316).withOpacity(0.1),
                    child: Center(
                      child: Image.asset(
                        'assets/images/logo_white.png', 
                        width: 120, 
                        errorBuilder: (_, __, ___) => const Icon(Icons.luggage_rounded, size: 80, color: Color(0xFFF97316)),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

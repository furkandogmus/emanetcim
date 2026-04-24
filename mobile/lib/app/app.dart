import 'dart:async';
import 'dart:ui';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/auth/auth_controller.dart';
import '../core/services/deep_link_service.dart';
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

class _BagajParkAppState extends ConsumerState<BagajParkApp>
    with WidgetsBindingObserver {
  bool _isInBackground = false;
  bool _isOffline = false;
  StreamSubscription? _connectivitySub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final isOffline = results.every((r) => r == ConnectivityResult.none);
      if (mounted) {
        setState(() => _isOffline = isOffline);
        if (!isOffline) {
          ref.read(syncServiceProvider).sync();
        }
      }
    });

    // Deep Link Init
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(deepLinkServiceProvider).init();
      ref.read(syncServiceProvider).sync();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _connectivitySub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    setState(() {
      _isInBackground =
          state == AppLifecycleState.inactive ||
          state == AppLifecycleState.paused;
    });
  }

  void _updateScreenProtection(UserDto? user) {
    if (user?.role == UserRole.partner) {
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
            if (_isOffline)
              Positioned(
                top: MediaQuery.of(context).padding.top,
                left: 0,
                right: 0,
                child: Material(
                  color: Colors.transparent,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    color: Colors.redAccent.withValues(alpha: 0.9),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.wifi_off_rounded,
                            color: Colors.white, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          'common.no_internet'.tr(),
                          style: GoogleFonts.outfit(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            if (_isInBackground)
              Positioned.fill(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    color: const Color(0xFFF97316).withValues(alpha: 0.1),
                    child: Center(
                      child: Image.asset(
                        'assets/images/logo_white.png',
                        width: 120,
                        errorBuilder: (_, _, _) => const Icon(
                          Icons.luggage_rounded,
                          size: 80,
                          color: Color(0xFFF97316),
                        ),
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

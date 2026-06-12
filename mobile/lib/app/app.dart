import 'dart:async';
import 'dart:ui';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:screen_protector/screen_protector.dart';

import '../core/auth/auth_controller.dart';
import '../core/auth/biometric_service.dart';
import '../core/auth/session_timeout.dart';
import '../core/services/deep_link_service.dart';
import '../core/sync/sync_service.dart';
import '../core/config/theme_mode_provider.dart';
import '../shared/models/user.dart';
import '../shared/utils/app_colors.dart';
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
    if (state == AppLifecycleState.resumed) {
      _checkBiometricOnResume();
    }
  }

  Future<void> _checkBiometricOnResume() async {
    if (BiometricService.shouldSkipOnResume) return;
    try {
      final biometric = ref.read(biometricServiceProvider);
      if (!await biometric.isEnabled) return;
      if (!await biometric.isAvailable) return;
      final ok = await biometric.authenticate(
        reason: 'profile.biometric_reason'.tr(),
      );
      if (!ok && mounted) {
        ref.read(authControllerProvider.notifier).logout();
      }
    } catch (_) {
      // Biometric check failed silently
    }
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
    ref.listen(authControllerProvider, (previous, current) {
      _updateScreenProtection(current.session);
    });

    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    // Session timeout listener'ı başlat
    ref.watch(sessionTimeoutProvider);

    return SessionTimeoutWrapper(
      child: MaterialApp.router(
        title: 'BagajPark',
        debugShowCheckedModeBanner: false,
        theme: buildLightTheme(),
        darkTheme: buildDarkTheme(),
        themeMode: themeMode,
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
        routerConfig: router,
        builder: (context, child) {
          return Stack(
            children: [
              child ?? const SizedBox.shrink(),
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
                          const Icon(
                            Icons.wifi_off_rounded,
                            color: Colors.white,
                            size: 16,
                          ),
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
                      color: AppColors.brandOrange.withValues(alpha: 0.1),
                      child: Center(
                        child: Image.asset(
                          'assets/images/logo_white.png',
                          width: 120,
                          errorBuilder: (_, _, _) => const Icon(
                            Icons.luggage_rounded,
                            size: 80,
                            color: AppColors.brandOrange,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

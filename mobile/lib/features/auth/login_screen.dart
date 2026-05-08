import 'dart:async' show unawaited;
import 'dart:io' show Platform;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/services/haptic_service.dart';
import '../../shared/utils/app_colors.dart';
import '../../shared/widgets/how_it_works_sheet.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _identity = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _busy = false;

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  bool _isValidPhone(String phone) {
    // Basic Turkish phone validation: 05xx xxx xx xx or 5xx xxx xx xx
    final clean = phone.replaceAll(RegExp(r'\D'), '');
    return (clean.length == 10 && clean.startsWith('5')) ||
        (clean.length == 11 && clean.startsWith('05'));
  }

  bool _isValid(String v) {
    return _isValidEmail(v) || _isValidPhone(v);
  }

  Future<void> _google() async {
    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).signInWithGoogle();
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _apple() async {
    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).signInWithApple();
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        backgroundColor: Colors.redAccent,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background gradients
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.brandOrange.withValues(alpha: 0.15),
              ),
            ),
          ),
          Positioned(
            bottom: -50,
            right: -50,
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.amber.withValues(alpha: 0.1),
              ),
            ),
          ),
          // Main content
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 40,
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Logo Section
                      Center(
                        child: Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.brandOrange.withValues(
                                  alpha: 0.15,
                                ),
                                blurRadius: 40,
                                spreadRadius: 5,
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.shopping_bag_outlined,
                            size: 56,
                            color: AppColors.brandOrange,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'BagajPark',
                        style: GoogleFonts.outfit(
                          fontSize: 36,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textDark,
                          letterSpacing: -1,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'auth.register_hint'.tr(),
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          color: const Color(0xFF424242),
                          letterSpacing: 0.2,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 32),

                      // Login Card
                      Container(
                        padding: const EdgeInsets.all(28),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(32),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.textDark.withValues(alpha: 0.04),
                              blurRadius: 30,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'auth.welcome'.tr(),
                              style: GoogleFonts.outfit(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textDark,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'auth.no_account'.tr(),
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    color: const Color(0xFF424242),
                                  ),
                                ),
                                TextButton(
                                  onPressed: () =>
                                      context.push('/auth/register'),
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                    ),
                                    minimumSize: Size.zero,
                                    tapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                  ),
                                  child: Text(
                                    'auth.register'.tr(),
                                    style: GoogleFonts.outfit(
                                      fontSize: 13,
                                      color: AppColors.brandOrange,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),
                            TextFormField(
                              controller: _identity,
                              keyboardType: TextInputType.emailAddress,
                              style: GoogleFonts.outfit(
                                fontWeight: FontWeight.w600,
                              ),
                              decoration: InputDecoration(
                                hintText: 'auth.email_or_phone'.tr(),
                                prefixIcon: const Icon(
                                  Icons.person_outline_rounded,
                                ),
                                helperText: 'auth.identity_hint'.tr(),
                                helperStyle: GoogleFonts.outfit(
                                  fontSize: 11,
                                  color: const Color(0xFF616161),
                                ),
                              ),
                              validator: (v) => _isValid(v ?? '')
                                  ? null
                                  : 'auth.invalid_identity'.tr(),
                            ),
                            const SizedBox(height: 20),
                            FilledButton(
                              onPressed: _busy ? null : _requestOtp,
                              style: FilledButton.styleFrom(
                                minimumSize: const Size(double.infinity, 56),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              child: _busy
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : Text(
                                      'auth.send_code'.tr(),
                                      style: GoogleFonts.outfit(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Divider
                      Row(
                        children: [
                          const Expanded(
                            child: Divider(
                              thickness: 1,
                              color: Color(0xFFE7E5E4),
                            ),
                          ), // gray-200
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Text(
                              'auth.or'.tr(),
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                color: const Color(0xFF616161),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const Expanded(
                            child: Divider(
                              thickness: 1,
                              color: Color(0xFFE7E5E4),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 24),

                      // Social Logins
                      OutlinedButton.icon(
                        onPressed: _busy ? null : _google,
                        icon: CachedNetworkImage(
                          imageUrl:
                              'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_Color_Icon.svg/1024px-Google_Color_Icon.svg.png',
                          height: 20,
                          placeholder: (context, url) =>
                              const Icon(Icons.login, size: 20),
                          errorWidget: (context, url, error) =>
                              const Icon(Icons.login),
                        ),
                        label: Text(
                          'auth.google'.tr(),
                          style: GoogleFonts.outfit(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),

                      if (Platform.isIOS || Platform.isMacOS) ...[
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _busy ? null : _apple,
                          icon: const Icon(Icons.apple, size: 24),
                          label: Text(
                            'auth.apple'.tr(),
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: Colors.black,
                            foregroundColor: Colors.white,
                            side: BorderSide.none,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      TextButton.icon(
                        onPressed: () {
                          ref.read(hapticServiceProvider).selection();
                          _showHowItWorks(context);
                        },
                        icon: const Icon(Icons.info_outline_rounded, size: 20),
                        label: Text(
                          'home.how_it_works'.tr(),
                          style: GoogleFonts.outfit(
                            color: AppColors.brandOrange,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
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

  void _showOtpSheet(String identity) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      builder: (context) => _OtpBottomSheet(identity: identity),
    );
  }

  Future<void> _requestOtp() async {
    unawaited(ref.read(hapticServiceProvider).light());
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final input = _identity.text.trim();
      await ref.read(authControllerProvider.notifier).requestOtp(input);
      if (!mounted) return;
      _showOtpSheet(input);
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _OtpBottomSheet extends ConsumerStatefulWidget {
  const _OtpBottomSheet({required this.identity});
  final String identity;

  @override
  ConsumerState<_OtpBottomSheet> createState() => _OtpBottomSheetState();
}

class _OtpBottomSheetState extends ConsumerState<_OtpBottomSheet> {
  final _code = TextEditingController();
  final _password = TextEditingController();
  bool _usePassword = false;
  bool _busy = false;
  int _timerCount = 60;
  bool _canResend = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _canResend = false;
    _timerCount = 60;
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      setState(() => _timerCount--);
      if (_timerCount <= 0) {
        setState(() => _canResend = true);
        return false;
      }
      return true;
    });
  }

  Future<void> _verify() async {
    unawaited(ref.read(hapticServiceProvider).light());
    if (_code.text.length < 6) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .verifyOtp(widget.identity, _code.text.trim());
      unawaited(ref.read(hapticServiceProvider).success());
      if (!mounted) return;
      context.go('/');
    } catch (e) {
      unawaited(ref.read(hapticServiceProvider).error());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Hatalı kod girdiniz.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verifyWithPassword() async {
    unawaited(ref.read(hapticServiceProvider).light());
    if (_password.text.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .loginWithPassword(widget.identity, _password.text.trim());
      unawaited(ref.read(hapticServiceProvider).success());
      if (!mounted) return;
      context.go('/');
    } catch (e) {
      unawaited(ref.read(hapticServiceProvider).error());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Hatalı şifre girdiniz.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _forgotPassword() async {
    final email = widget.identity.trim();
    if (!email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('auth.forgot_password_email_only'.tr())),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post(
        '/auth/password-reset/request',
        data: {'email': email, 'locale': context.locale.languageCode},
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('auth.forgot_password_sent'.tr())));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('auth.forgot_password_sent'.tr())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(
                  'auth.enter_code'.tr(),
                  style: GoogleFonts.outfit(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'auth.otp_sent'.tr(args: [widget.identity]),
              style: GoogleFonts.outfit(color: const Color(0xFF616161)),
            ),
            const SizedBox(height: 32),
            if (!_usePassword)
              TextField(
                key: const ValueKey('login_code_field'),
                controller: _code,
                autofocus: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  fontSize: 32,
                  letterSpacing: 8,
                  fontWeight: FontWeight.bold,
                  color: AppColors.brandOrange,
                ),
                decoration: InputDecoration(
                  counterText: '',
                  hintText: '0 0 0 0 0 0',
                  hintStyle: GoogleFonts.outfit(
                    color: Colors.grey.shade200,
                    letterSpacing: 8,
                  ),
                  filled: true,
                  fillColor: Colors.grey.shade50,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                ),
                onChanged: (v) {
                  if (v.length == 6) _verify();
                },
              )
            else
              TextField(
                key: const ValueKey('login_password_field'),
                controller: _password,
                autofocus: true,
                obscureText: true,
                keyboardType: TextInputType.visiblePassword,
                enableSuggestions: false,
                autocorrect: false,
                style: GoogleFonts.outfit(fontSize: 18),
                decoration: InputDecoration(
                  hintText: 'Şifre'.tr(),
                  filled: true,
                  fillColor: Colors.grey.shade50,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 16,
                  ),
                ),
              ),
            const SizedBox(height: 32),
            FilledButton(
              onPressed:
                  _busy ||
                      (!_usePassword && _code.text.length < 6) ||
                      (_usePassword && _password.text.isEmpty)
                  ? null
                  : (_usePassword ? _verifyWithPassword : _verify),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.brandOrange,
                minimumSize: const Size(double.infinity, 56),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: _busy
                  ? const CircularProgressIndicator(color: Colors.white)
                  : Text(_usePassword ? 'Giriş Yap'.tr() : 'auth.verify'.tr()),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () {
                FocusManager.instance.primaryFocus?.unfocus();
                setState(() => _usePassword = !_usePassword);
              },
              child: Text(
                _usePassword
                    ? 'Kod ile Giriş Yap'.tr()
                    : 'Şifre ile Giriş Yap'.tr(),
              ),
            ),
            if (_usePassword)
              TextButton(
                onPressed: _busy ? null : _forgotPassword,
                child: Text('auth.forgot_password'.tr()),
              ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: _canResend ? () => Navigator.pop(context) : null,
              child: Text(
                _canResend
                    ? 'auth.resend_code'.tr()
                    : 'auth.resend_wait'.tr(args: [_timerCount.toString()]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

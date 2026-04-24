import 'dart:io' show Platform;
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../core/auth/auth_controller.dart';
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
    final theme = Theme.of(context);

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              theme.colorScheme.surface,
              Colors.orange.shade50.withValues(alpha: 0.5),
              theme.colorScheme.surface,
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 40),
                    // Logo Section
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.orange.withValues(alpha: 0.1),
                              blurRadius: 40,
                              spreadRadius: 10,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.shopping_bag_outlined,
                          size: 48,
                          color: Color(0xFFF97316),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      'BagajPark',
                      style: theme.textTheme.displayLarge?.copyWith(
                        color: const Color(0xFFF97316),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'auth.register_hint'.tr(),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.grey.shade600,
                        letterSpacing: 0.2,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 48),

                    // Login Card
                    Card(
                      elevation: 0,
                      color: Colors.white,
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'auth.welcome'.tr(),
                              style: theme.textTheme.headlineMedium,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 24),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'auth.no_account'.tr(),
                                  style: GoogleFonts.outfit(
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                                TextButton(
                                  onPressed: () =>
                                      context.push('/auth/register'),
                                  child: Text(
                                    'auth.register'.tr(),
                                    style: GoogleFonts.outfit(
                                      color: const Color(0xFFF97316),
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            const Divider(),
                            const SizedBox(height: 24),
                            TextFormField(
                              controller: _identity,
                              keyboardType: TextInputType.emailAddress,
                              style: GoogleFonts.outfit(),
                              decoration: InputDecoration(
                                hintText: 'auth.email_or_phone'.tr(),
                                prefixIcon: const Icon(
                                  Icons.person_outline_rounded,
                                ),
                                helperText: 'Örn: 05xx xxx xx xx veya e-posta',
                                helperStyle: const TextStyle(fontSize: 10),
                              ),
                              validator: (v) => _isValid(v ?? '')
                                  ? null
                                  : 'auth.invalid_identity'.tr(),
                            ),
                            const SizedBox(height: 24),
                            FilledButton(
                              onPressed: _busy ? null : _requestOtp,
                              child: _busy
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : Text('auth.send_code'.tr()),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 40),

                    // Divider
                    Row(
                      children: [
                        const Expanded(child: Divider(thickness: 1)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            'auth.or'.tr(),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: Colors.grey.shade500,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const Expanded(child: Divider(thickness: 1)),
                      ],
                    ),

                    const SizedBox(height: 40),

                    // Social Logins
                    OutlinedButton.icon(
                      onPressed: _busy ? null : _google,
                      icon: CachedNetworkImage(
                        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_Color_Icon.svg/1024px-Google_Color_Icon.svg.png',
                        height: 24,
                        placeholder: (context, url) => const Icon(Icons.login, size: 24),
                        errorWidget: (context, url, error) => const Icon(Icons.login),
                      ),
                      label: Text('auth.google'.tr()),
                    ),

                    if (Platform.isIOS || Platform.isMacOS) ...[
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: _busy ? null : _apple,
                        icon: const Icon(Icons.apple, size: 28),
                        label: Text('auth.apple'.tr()),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: Colors.black,
                          foregroundColor: Colors.white,
                          side: BorderSide.none,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    TextButton.icon(
                      onPressed: () => _showHowItWorks(context),
                      icon: const Icon(Icons.info_outline_rounded, size: 20),
                      label: Text(
                        'home.how_it_works'.tr(),
                        style: GoogleFonts.outfit(
                          color: const Color(0xFFF97316),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    TextButton(
                      onPressed: () =>
                          ref.read(authControllerProvider.notifier).skipLogin(),
                      child: Text(
                        'auth.demo_guest'.tr(),
                        style: GoogleFonts.outfit(
                          color: Colors.grey.shade600,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => ref
                          .read(authControllerProvider.notifier)
                          .skipLoginAsPartner(),
                      child: Text(
                        'auth.demo_partner'.tr(),
                        style: GoogleFonts.outfit(
                          color: const Color(0xFFF97316),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ),
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
    if (_code.text.length < 6) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .verifyOtp(widget.identity, _code.text.trim());
      if (!mounted) return;
      context.go('/');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Hatalı kod girdiniz.'),
          backgroundColor: Colors.redAccent,
        ),
      );
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
                  'Kodunuzu Girin',
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
              style: GoogleFonts.outfit(color: Colors.grey),
            ),
            const SizedBox(height: 32),
            TextField(
              controller: _code,
              autofocus: true,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 32,
                letterSpacing: 8,
                fontWeight: FontWeight.bold,
                color: const Color(0xFFF97316),
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
            ),
            const SizedBox(height: 32),
            FilledButton(
              onPressed: _busy || _code.text.length < 6 ? null : _verify,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFF97316),
                minimumSize: const Size(double.infinity, 56),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: _busy
                  ? const CircularProgressIndicator(color: Colors.white)
                  : Text('auth.verify'.tr()),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: _canResend ? () => Navigator.pop(context) : null,
              child: Text(
                _canResend
                    ? 'Kodu tekrar gönder'
                    : 'Tekrar gönder (${_timerCount}s)',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

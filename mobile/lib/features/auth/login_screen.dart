import 'dart:io' show Platform;
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_controller.dart';

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

  Future<void> _requestOtp() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final input = _identity.text.trim();
      await ref.read(authControllerProvider.notifier).requestOtp(input);
      if (!mounted) return;
      context.push('/auth/otp?email=${Uri.encodeComponent(input)}');
    } catch (e) {
      _toast('$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
                      icon: Image.network(
                        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_Color_Icon.svg/1024px-Google_Color_Icon.svg.png',
                        height: 24,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(Icons.login),
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
}

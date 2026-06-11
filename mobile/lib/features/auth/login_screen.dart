import 'dart:async' show unawaited;
import 'dart:io' show Platform;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
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
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _busy = false;
  bool _obscure = true;

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  bool _isValidPhone(String phone) {
    final clean = phone.replaceAll(RegExp(r'\D'), '');
    return (clean.length == 10 && clean.startsWith('5')) ||
        (clean.length == 11 && clean.startsWith('05'));
  }

  bool _isValid(String v) {
    return _isValidEmail(v) || _isValidPhone(v);
  }

  Future<void> _login() async {
    unawaited(ref.read(hapticServiceProvider).light());
    if (!_formKey.currentState!.validate()) return;
    if (_password.text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .loginWithPassword(_identity.text.trim(), _password.text.trim());
      if (!mounted) return;
      context.go('/');
    } on DioException catch (e) {
      final code = e.response?.data?['error'] as String?;
      if (code == 'invalid_credentials') {
        _toast('auth.invalid_credentials'.tr());
      } else if (code == 'too_many_attempts') {
        _toast('auth.too_many_attempts'.tr());
      } else if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
        _toast('common.no_internet'.tr());
      } else {
        _toast('common.error'.tr());
      }
    } catch (e) {
      _toast('common.error'.tr());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _google() async {
    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).signInWithGoogle();
      if (!mounted) return;
      context.go('/');
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
        _toast('common.no_internet'.tr());
      } else {
        _toast('auth.google_error'.tr());
      }
    } catch (e) {
      if (!mounted) return;
      _toast('auth.google_error'.tr());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _apple() async {
    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).signInWithApple();
      if (!mounted) return;
      context.go('/');
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
        _toast('common.no_internet'.tr());
      } else {
        _toast('auth.apple_error'.tr());
      }
    } catch (e) {
      if (!mounted) return;
      _toast('auth.apple_error'.tr());
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
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isTablet = constraints.maxWidth > 600;
          return Stack(
            children: [
              Positioned(
                top: -100,
                left: -100,
                child: Container(
                  width: isTablet ? 400 : 300,
                  height: isTablet ? 400 : 300,
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
                  width: isTablet ? 350 : 250,
                  height: isTablet ? 350 : 250,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.amber.withValues(alpha: 0.1),
                  ),
                ),
              ),
              SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(
                      horizontal: isTablet ? 48 : 24,
                      vertical: 40,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        ConstrainedBox(
                          constraints: BoxConstraints(
                            maxWidth: isTablet ? 420 : double.infinity,
                          ),
                          child: Form(
                            key: _formKey,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Center(
                                  child: Container(
                                    padding: const EdgeInsets.all(24),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      shape: BoxShape.circle,
                                      boxShadow: [
                                        BoxShadow(
                                          color: AppColors.brandOrange.withValues(alpha: 0.15),
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
                                    fontSize: isTablet ? 42 : 36,
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
                                    fontSize: isTablet ? 16 : 14,
                                    color: const Color(0xFF424242),
                                    letterSpacing: 0.2,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 32),
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
                                          fontSize: isTablet ? 26 : 22,
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
                                              fontSize: isTablet ? 15 : 13,
                                              color: const Color(0xFF424242),
                                            ),
                                          ),
                                          TextButton(
                                            onPressed: () => context.push('/auth/register'),
                                            style: TextButton.styleFrom(
                                              padding: const EdgeInsets.symmetric(horizontal: 8),
                                              minimumSize: Size.zero,
                                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                            ),
                                            child: Text(
                                              'auth.register'.tr(),
                                              style: GoogleFonts.outfit(
                                                fontSize: isTablet ? 15 : 13,
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
                                        style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: isTablet ? 18 : 16),
                                        decoration: InputDecoration(
                                          hintText: 'auth.email_or_phone'.tr(),
                                          prefixIcon: const Icon(Icons.person_outline_rounded),
                                          helperText: 'auth.identity_hint'.tr(),
                                          helperStyle: GoogleFonts.outfit(fontSize: isTablet ? 13 : 11, color: const Color(0xFF616161)),
                                        ),
                                        validator: (v) => _isValid(v ?? '') ? null : 'auth.invalid_identity'.tr(),
                                      ),
                                      const SizedBox(height: 20),
                                      TextFormField(
                                        controller: _password,
                                        obscureText: _obscure,
                                        keyboardType: TextInputType.visiblePassword,
                                        style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: isTablet ? 18 : 16),
                                        decoration: InputDecoration(
                                          hintText: 'auth.password'.tr(),
                                          prefixIcon: const Icon(Icons.lock_outline_rounded),
                                          suffixIcon: IconButton(
                                            icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                                            onPressed: () => setState(() => _obscure = !_obscure),
                                          ),
                                        ),
                                        onFieldSubmitted: (_) => _login(),
                                      ),
                                      const SizedBox(height: 8),
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: TextButton(
                                          onPressed: _busy ? null : _forgotPassword,
                                          child: Text('auth.forgot_password'.tr(), style: GoogleFonts.outfit(fontSize: isTablet ? 15 : 13)),
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      FilledButton(
                                        onPressed: _busy ? null : _login,
                                        style: FilledButton.styleFrom(
                                          minimumSize: Size(double.infinity, isTablet ? 64 : 56),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                        ),
                                        child: _busy
                                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                            : Text('auth.sign_in'.tr(), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: isTablet ? 18 : 16)),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 24),
                                Row(
                                  children: [
                                    const Expanded(child: Divider(thickness: 1, color: Color(0xFFE7E5E4))),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 16),
                                      child: Text('auth.or'.tr(), style: GoogleFonts.outfit(fontSize: isTablet ? 14 : 12, color: const Color(0xFF616161), fontWeight: FontWeight.w600)),
                                    ),
                                    const Expanded(child: Divider(thickness: 1, color: Color(0xFFE7E5E4))),
                                  ],
                                ),
                                const SizedBox(height: 24),
                                OutlinedButton.icon(
                                  onPressed: _busy ? null : _google,
                                  icon: CachedNetworkImage(
                                    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_Color_Icon.svg/1024px-Google_Color_Icon.svg.png',
                                    height: 20,
                                    placeholder: (_, __) => const Icon(Icons.login, size: 20),
                                    errorWidget: (_, __, ___) => const Icon(Icons.login),
                                  ),
                                  label: Text('auth.google'.tr(), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: isTablet ? 16 : 14)),
                                  style: OutlinedButton.styleFrom(
                                    padding: EdgeInsets.symmetric(vertical: isTablet ? 20 : 16),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                  ),
                                ),
                                if (Platform.isIOS) ...[
                                  const SizedBox(height: 12),
                                  OutlinedButton.icon(
                                    onPressed: _busy ? null : _apple,
                                    icon: const Icon(Icons.apple, size: 24),
                                    label: Text('auth.apple'.tr(), style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: isTablet ? 16 : 14)),
                                    style: OutlinedButton.styleFrom(
                                      backgroundColor: Colors.black,
                                      foregroundColor: Colors.white,
                                      side: BorderSide.none,
                                      padding: EdgeInsets.symmetric(vertical: isTablet ? 20 : 16),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
                                  label: Text('home.how_it_works'.tr(), style: GoogleFonts.outfit(color: AppColors.brandOrange, fontWeight: FontWeight.bold)),
                                ),
                                const SizedBox(height: 20),
                              ],
                            ),
                          ),
                        ),
                      ],
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

  void _showHowItWorks(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => const HowItWorksSheet(),
    );
  }

  Future<void> _forgotPassword() async {
    final input = _identity.text.trim();
    if (input.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('auth.forgot_password_enter_email'.tr())),
      );
      return;
    }
    if (input.contains('@')) {
      setState(() => _busy = true);
      try {
        final dio = ref.read(dioProvider);
        await dio.post('/auth/password-reset/request', data: {
          'email': input,
          'locale': context.locale.languageCode,
        });
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('auth.forgot_password_sent'.tr())),
        );
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('auth.forgot_password_sent'.tr())),
        );
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('auth.forgot_password_email_only'.tr()),
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }
}

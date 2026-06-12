import 'dart:async' show unawaited;
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _identityController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _kvkkAccepted = false;
  bool _busy = false;
  bool _obscure = true;

  @override
  void dispose() {
    _nameController.dispose();
    _identityController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  String? _normalizePhone(String phone) {
    if (phone.trim().isEmpty) return null;
    var d = phone.replaceAll(RegExp(r'\D'), '');
    if (d.startsWith('90') && d.length >= 12) {
      d = d.substring(2);
    }
    if (d.startsWith('0') && d.length == 11) {
      d = d.substring(1);
    }
    if (d.length == 10 && d.startsWith('5')) {
      return d;
    }
    return null;
  }

  bool _isValidPhone(String phone) {
    return _normalizePhone(phone) != null;
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate() || !_kvkkAccepted) return;

    setState(() => _busy = true);
    try {
      final identity = _identityController.text.trim();
      final password = _passwordController.text.trim();
      final name = _nameController.text.trim();
      final isEmail = identity.contains('@');
      final cleanIdentity = isEmail ? identity : _normalizePhone(identity)!;

      final dio = ref.read(dioProvider);
      final data = <String, dynamic>{
        if (isEmail) 'email': cleanIdentity else 'phone': cleanIdentity,
        'password': password,
        if (name.isNotEmpty) 'name': name,
      };

      await dio.post('/auth/register', data: data);

      await ref
          .read(authControllerProvider.notifier)
          .loginWithPassword(identity, password);

      if (mounted) context.go('/');
    } on DioException catch (e) {
      if (mounted) {
        final err = e.response?.data?['error'];
        final msg = err == 'invalid_credentials'
            ? 'auth.invalid_credentials'.tr()
            : 'common.error'.tr();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('common.error'.tr())),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('auth.register'.tr(), style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
      ),
      body: Builder(
        builder: (ctx) {
          final isTablet = MediaQuery.sizeOf(ctx).width > 600;
          return Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.all(isTablet ? 48 : 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: isTablet ? 420 : double.infinity),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'auth.register_welcome'.tr(),
                        style: (isTablet ? theme.textTheme.headlineLarge : theme.textTheme.headlineMedium)?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'auth.register_hint'.tr(),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontSize: isTablet ? 16 : 14,
                          color: const Color(0xFF424242),
                        ),
                      ),
                      const SizedBox(height: 32),

                      TextFormField(
                        controller: _nameController,
                        style: GoogleFonts.outfit(fontSize: isTablet ? 18 : 16),
                        decoration: InputDecoration(
                          labelText: 'auth.name_label'.tr(),
                          prefixIcon: const Icon(Icons.person_outline_rounded),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        validator: (v) {
                          if (v == null || v.isEmpty) return 'auth.name_error'.tr();
                          if (v.length < 3) return 'auth.name_error'.tr();
                          if (!RegExp(r'^[a-zA-ZçÇğĞıİöÖşŞüÜ\s]+$').hasMatch(v)) {
                            return 'auth.name_invalid_error'.tr();
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),

                      TextFormField(
                        controller: _identityController,
                        style: GoogleFonts.outfit(fontSize: isTablet ? 18 : 16),
                        decoration: InputDecoration(
                          labelText: 'auth.email_or_phone'.tr(),
                          prefixIcon: const Icon(Icons.mail_outline_rounded),
                          hintText: 'E-posta veya 05xx xxx xx xx',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        keyboardType: TextInputType.emailAddress,
                        validator: (v) {
                          final input = v ?? '';
                          if (input.isEmpty) return 'auth.invalid_identity'.tr();
                          if (_isValidEmail(input) || _isValidPhone(input)) return null;
                          return 'auth.invalid_identity'.tr();
                        },
                      ),
                      const SizedBox(height: 16),

                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscure,
                        keyboardType: TextInputType.visiblePassword,
                        style: GoogleFonts.outfit(fontSize: isTablet ? 18 : 16),
                        decoration: InputDecoration(
                          labelText: 'auth.password'.tr(),
                          prefixIcon: const Icon(Icons.lock_outline_rounded),
                          suffixIcon: IconButton(
                            icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        validator: (v) {
                          if (v == null || v.length < 6) return 'auth.password_error'.tr();
                          return null;
                        },
                        onChanged: (_) => setState(() {}),
                      ),

                      if (_passwordController.text.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        _buildPasswordStrength(),
                      ],

                      const SizedBox(height: 24),

                      Row(
                        children: [
                          Checkbox(
                            value: _kvkkAccepted,
                            onChanged: (v) {
                              unawaited(HapticFeedback.lightImpact());
                              setState(() => _kvkkAccepted = v ?? false);
                            },
                            activeColor: const Color(0xFFF97316),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () {
                                unawaited(HapticFeedback.lightImpact());
                                _showLegalModal(
                                  context,
                                  '${'auth.terms_service'.tr()} & KVKK',
                                  'BagajPark olarak verilerinizi 6698 sayılı KVKK kapsamında titizlikle koruyoruz...',
                                );
                              },
                              child: Text.rich(
                                TextSpan(
                                  text: 'auth.terms_service'.tr(),
                                  style: const TextStyle(decoration: TextDecoration.underline),
                                  children: [
                                    TextSpan(
                                      text: ' ${'auth.or'.tr()} ',
                                      style: const TextStyle(decoration: TextDecoration.none),
                                    ),
                                    TextSpan(
                                      text: 'auth.privacy_policy'.tr(),
                                      style: const TextStyle(color: Color(0xFFF97316), fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                                    ),
                                    const TextSpan(
                                      text: ' okudum, onaylıyorum.',
                                      style: TextStyle(decoration: TextDecoration.none),
                                    ),
                                  ],
                                ),
                                style: theme.textTheme.bodySmall?.copyWith(fontSize: isTablet ? 14 : 12),
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 32),

FilledButton(
  onPressed: (_busy || !_kvkkAccepted) ? null : _register,
  style: FilledButton.styleFrom(
    minimumSize: Size(double.infinity, isTablet ? 64 : 56),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
  ),
  child: Semantics(
    label: 'Kayıt Ol',
    child: _busy
        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
        : Text('auth.register_button'.tr(), style: GoogleFonts.outfit(fontSize: isTablet ? 18 : 16)),
  ),
),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _showLegalModal(BuildContext context, String title, String content) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Text(content, style: GoogleFonts.outfit(height: 1.6)),
            const SizedBox(height: 32),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
              ),
              child: Text('common.confirm'.tr()),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildPasswordStrength() {
    final pw = _passwordController.text;
    final strength = _getPasswordStrength(pw);
    final color = strength.color;
    final label = strength.label;
    final percent = strength.percent;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              '${'profile.password_strength'.tr()}: $label',
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: percent,
            backgroundColor: Colors.grey.shade200,
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 4,
          ),
        ),
      ],
    );
  }

  _StrengthResult _getPasswordStrength(String password) {
    int score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (RegExp(r'[A-Z]').hasMatch(password)) score++;
    if (RegExp(r'[a-z]').hasMatch(password)) score++;
    if (RegExp(r'[0-9]').hasMatch(password)) score++;
    if (RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(password)) score++;

    if (score <= 1) {
      return _StrengthResult('profile.strength_weak'.tr(), Colors.redAccent, 0.25);
    } else if (score <= 2) {
      return _StrengthResult('profile.strength_fair'.tr(), Colors.orange, 0.5);
    } else if (score <= 4) {
      return _StrengthResult('profile.strength_good'.tr(), Colors.lightGreen, 0.75);
    } else {
      return _StrengthResult('profile.strength_strong'.tr(), Colors.green, 1.0);
    }
  }
}

class _StrengthResult {
  final String label;
  final Color color;
  final double percent;
  const _StrengthResult(this.label, this.color, this.percent);
}

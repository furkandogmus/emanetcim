import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_controller.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({required this.identity, super.key, this.name});
  final String identity;
  final String? name; // For registration

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  int _timerCount = 60;
  bool _canResend = false;
  bool _usePassword = false;

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
          .verifyOtp(widget.identity, _code.text.trim(), name: widget.name);
      if (!mounted) return;
      context.go('/');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('auth.otp_error'.tr()),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verifyWithPassword() async {
    if (_password.text.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .loginWithPassword(widget.identity, _password.text.trim());
      if (!mounted) return;
      context.go('/');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('auth.otp_error'.tr()),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent),
      body: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'auth.verify_title'.tr(),
              style: GoogleFonts.outfit(
                fontSize: 32,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'auth.otp_sent'.tr(args: [widget.identity]),
              style: GoogleFonts.outfit(color: const Color(0xFF616161)),
            ),
            const SizedBox(height: 48),
            if (!_usePassword)
              TextField(
                key: const ValueKey('otp_code_field'),
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
              )
            else
              TextField(
                key: const ValueKey('otp_password_field'),
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
                      _usePassword
                          ? 'Giriş Yap'.tr()
                          : 'auth.verify_button'.tr(),
                    ),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: _canResend ? _startTimer : null,
              child: Text(
                _canResend
                    ? 'auth.resend'.tr()
                    : '${'auth.resend'.tr()} (${_timerCount}s)',
              ),
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
          ],
        ),
      ),
    );
  }
}

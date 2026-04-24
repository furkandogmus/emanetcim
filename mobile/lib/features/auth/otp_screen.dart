import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_controller.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.identity, this.name});
  final String identity;
  final String? name; // For registration

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
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
              style: GoogleFonts.outfit(color: Colors.grey),
            ),
            const SizedBox(height: 48),
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
              child: _busy
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text('auth.verify_button'.tr()),
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
          ],
        ),
      ),
    );
  }
}

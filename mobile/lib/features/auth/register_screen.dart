import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  bool _kvkkAccepted = false;
  bool _busy = false;

  Future<void> _register() async {
    if (!_formKey.currentState!.validate() || !_kvkkAccepted) return;
    
    setState(() => _busy = true);
    try {
      // Kayıt işlemi için de OTP akışını başlatıyoruz
      await ref.read(authControllerProvider.notifier).requestOtp(_emailController.text);
      if (mounted) {
        context.push('/auth/otp?email=${_emailController.text}&name=${_nameController.text}');
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('Kayıt Ol', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Aramıza Hoş Geldin! 👋',
                style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Valizlerini güvenle emanet etmek için hemen hesabını oluştur.',
                style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey.shade600),
              ),
              const SizedBox(height: 32),
              
              TextFormField(
                controller: _nameController,
                decoration: InputDecoration(
                  labelText: 'Ad Soyad',
                  prefixIcon: const Icon(Icons.person_outline_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                ),
                validator: (v) => (v?.length ?? 0) < 3 ? 'Lütfen adınızı giriniz' : null,
              ),
              const SizedBox(height: 16),
              
              TextFormField(
                controller: _emailController,
                decoration: InputDecoration(
                  labelText: 'E-posta',
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (v) => (v?.contains('@') ?? false) ? null : 'Geçerli bir e-posta giriniz',
              ),
              
              const SizedBox(height: 24),
              
              Row(
                children: [
                  Checkbox(
                    value: _kvkkAccepted,
                    onChanged: (v) {
                      HapticFeedback.lightImpact();
                      setState(() => _kvkkAccepted = v ?? false);
                    },
                    activeColor: const Color(0xFFF97316),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        _showLegalModal(context, 'Kullanım Koşulları & KVKK', 'BagajPark olarak verilerinizi 6698 sayılı KVKK kapsamında titizlikle koruyoruz. Uygulamamızı kullanarak valizlerinizi güvenli noktalarımıza emanet edebilir, ödemelerinizi uçtan uca şifreli altyapımızla gerçekleştirebilirsiniz...');
                      },
                      child: Text.rich(
                        TextSpan(
                          text: 'Kullanım Koşullarını',
                          style: const TextStyle(decoration: TextDecoration.underline),
                          children: [
                            const TextSpan(text: ' ve ', style: TextStyle(decoration: TextDecoration.none)),
                            const TextSpan(
                              text: 'KVKK Aydınlatma Metnini',
                              style: TextStyle(color: Color(0xFFF97316), fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                            ),
                            const TextSpan(text: ' okudum, onaylıyorum.', style: TextStyle(decoration: TextDecoration.none)),
                          ],
                        ),
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 32),
              
              FilledButton(
                onPressed: (_busy || !_kvkkAccepted) ? null : _register,
                child: _busy 
                  ? const CircularProgressIndicator(color: Colors.white) 
                  : const Text('Kayıt Ol ve Kod Gönder'),
              ),
            ],
          ),
        ),
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
            Text(title, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Text(content, style: GoogleFonts.outfit(height: 1.6)),
            const SizedBox(height: 32),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
              child: const Text('Anladım'),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

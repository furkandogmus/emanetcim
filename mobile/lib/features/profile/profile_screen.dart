import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/models/user.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).session;
    final theme = Theme.of(context);
    final isPartner = user?.role == UserRole.partner;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'profile.title'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        children: [
          // Header Section
          Center(
            child: Column(
              children: [
                Stack(
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF97316).withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFFF97316),
                          width: 2,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          user?.name?.substring(0, 1).toUpperCase() ?? '?',
                          style: GoogleFonts.outfit(
                            fontSize: 40,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFFF97316),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: Color(0xFFF97316),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.camera_alt_rounded,
                          size: 16,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  user?.name ?? 'Kullanıcı',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user?.email ?? '',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),

          // Stats Section
          Row(
            children: [
              _statItem('0', 'Rezervasyon'),
              _statItem('₺0', 'Tasarruf'),
              _statItem('0', 'Favori'),
            ],
          ),

          const SizedBox(height: 32),

          if (isPartner) ...[
            _sectionHeader('partner.management'.tr()),
            _menuItem(
              Icons.payments_rounded,
              'partner.earnings'.tr(),
              onTap: () => context.push('/partner/earnings'),
            ),
            _menuItem(
              Icons.settings_suggest_rounded,
              'partner.settings'.tr(),
              onTap: () => context.push('/partner/settings'),
            ),
            const SizedBox(height: 24),
          ],

          // Referral Card (Only for Guests)
          if (!isPartner) ...[_referralCard(user), const SizedBox(height: 32)],

          // Menu Section
          _sectionHeader('profile.settings'.tr()),
          _menuItem(
            Icons.person_outline_rounded,
            'profile.edit_profile'.tr(),
            onTap: () => _showEditProfile(context, user),
          ),
          _menuItem(
            Icons.notifications_none_rounded,
            'profile.notifications'.tr(),
            onTap: () => _showInfo(
              context,
              'profile.notifications'.tr(),
              'Tüm bildirimleriniz ve kampanya duyuruları burada listelenir. Şu an için aktif bir bildiriminiz bulunmuyor.',
            ),
          ),

          const SizedBox(height: 32),

          _sectionHeader('profile.support'.tr()),
          _menuItem(
            Icons.help_outline_rounded,
            'profile.help_center'.tr(),
            onTap: () => _showLegal(
              context,
              'profile.help_center'.tr(),
              'destek@bagajpark.com',
            ),
          ),
          _menuItem(
            Icons.privacy_tip_outlined,
            'profile.privacy'.tr(),
            onTap: () => _showLegal(context, 'profile.privacy'.tr(), _privacyPolicyText),
          ),
          _menuItem(
            Icons.gavel_rounded,
            'profile.terms_of_service'.tr(),
            onTap: () => _showLegal(context, 'profile.terms_of_service'.tr(), _termsOfServiceText),
          ),
          _menuItem(
            Icons.info_outline_rounded,
            'profile.about'.tr(),
            onTap: () =>
                _showLegal(context, 'profile.about'.tr(), 'BagajPark v1.0.0'),
          ),

          const SizedBox(height: 48),

          // Logout Button
          OutlinedButton.icon(
            onPressed: () => _confirmLogout(context, ref),
            icon: const Icon(Icons.logout_rounded, size: 20),
            label: Text('profile.logout'.tr()),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.redAccent,
              side: const BorderSide(color: Colors.redAccent, width: 1.5),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),

          const SizedBox(height: 12),

          // Delete Account (Apple Requirement)
          TextButton(
            onPressed: () => _showDeleteAccount(context, ref),
            child: Text(
              'profile.delete_account'.tr(),
              style: GoogleFonts.outfit(
                color: Colors.grey.shade400,
                fontSize: 13,
                decoration: TextDecoration.underline,
              ),
            ),
          ),

          const SizedBox(height: 32),

          Center(
            child: Text(
              'Versiyon 1.0.0',
              style: GoogleFonts.outfit(
                fontSize: 11,
                color: Colors.grey.shade400,
              ),
            ),
          ),

          const SizedBox(height: 100),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, left: 4),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.outfit(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: Colors.grey.shade500,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _referralCard(UserDto? user) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: const BoxDecoration(
                  color: Colors.white10,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.card_giftcard_rounded,
                  color: Color(0xFFF97316),
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'profile.referral_title'.tr(),
                      style: GoogleFonts.outfit(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'profile.referral_hint'.tr(),
                      style: GoogleFonts.outfit(
                        color: Colors.grey.shade400,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  user?.referralCode ?? 'BP-WELCOME',
                  style: GoogleFonts.outfit(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                    letterSpacing: 2,
                  ),
                ),
                TextButton.icon(
                  onPressed: () => Clipboard.setData(
                    ClipboardData(text: user?.referralCode ?? 'BP-WELCOME'),
                  ),
                  icon: const Icon(
                    Icons.copy_rounded,
                    size: 18,
                    color: Color(0xFFF97316),
                  ),
                  label: Text(
                    'profile.copy'.tr(),
                    style: GoogleFonts.outfit(
                      color: const Color(0xFFF97316),
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _menuItem(IconData icon, String title, {required VoidCallback onTap}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        tileColor: Colors.white,
        leading: Icon(icon, color: const Color(0xFF0F172A), size: 22),
        title: Text(
          title,
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: const Color(0xFF0F172A),
          ),
        ),
        trailing: Icon(
          Icons.arrow_forward_ios_rounded,
          size: 14,
          color: Colors.grey.shade300,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
      ),
    );
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'profile.logout'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Hesabınızdan çıkış yapmak istediğinize emin misiniz?',
          style: GoogleFonts.outfit(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('common.cancel'.tr()),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(authControllerProvider.notifier).logout();
            },
            child: Text(
              'profile.logout'.tr(),
              style: const TextStyle(color: Colors.redAccent),
            ),
          ),
        ],
      ),
    );
  }

  void _showDeleteAccount(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'profile.delete_account'.tr(),
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: Colors.redAccent,
          ),
        ),
        content: Text(
          'profile.delete_account_confirm'.tr(),
          style: GoogleFonts.outfit(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('common.cancel'.tr()),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              final success = await ref
                  .read(authControllerProvider.notifier)
                  .requestAccountDeletion();

              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      success
                          ? 'profile.delete_account_success'.tr()
                          : 'profile.delete_account_error'.tr(),
                    ),
                    backgroundColor: success ? Colors.green : Colors.redAccent,
                  ),
                );
              }
            },
            child: Text(
              'common.confirm'.tr(),
              style: const TextStyle(
                color: Colors.redAccent,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showEditProfile(BuildContext context, UserDto? user) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 24,
          right: 24,
          top: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'profile.edit_profile'.tr(),
              style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),
            TextField(
              decoration: InputDecoration(
                labelText: 'auth.name_label'.tr(),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              controller: TextEditingController(text: user?.name),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: Text('common.confirm'.tr()),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  void _showInfo(BuildContext context, String title, String msg) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          title,
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        content: Text(msg, style: GoogleFonts.outfit()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('common.confirm'.tr()),
          ),
        ],
      ),
    );
  }

  void _showLegal(BuildContext context, String title, String content) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        expand: false,
        builder: (_, scroll) => Padding(
          padding: const EdgeInsets.all(24),
          child: ListView(
            controller: scroll,
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
            ],
          ),
        ),
      ),
    );
  }

  Widget _statItem(String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0F172A),
            ),
          ),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 12,
              color: Colors.grey.shade500,
            ),
          ),
        ],
      ),
    );
  }

  static const String _privacyPolicyText = '''
BagajPark olarak gizliliğinize önem veriyoruz. Bu metin, verilerinizin nasıl toplandığını ve kullanıldığını açıklar.

1. Toplanan Veriler
Hizmetimizi sunabilmek için adınız, e-posta adresiniz, telefon numaranız ve konum bilginiz gibi temel bilgileri topluyoruz.

2. Verilerin Kullanımı
Verileriniz sadece rezervasyon işlemlerini gerçekleştirmek, güvenliği sağlamak ve size bildirim göndermek amacıyla kullanılır.

3. Üçüncü Taraflar
Verileriniz yasal zorunluluklar dışında üçüncü taraflarla paylaşılmaz. Ödeme işlemleri güvenli aracı kurumlar üzerinden yürütülür.
''';

  static const String _termsOfServiceText = '''
BagajPark Kullanım Koşulları

1. Hizmet Tanımı
BagajPark, eşyalarınızı güvenli noktalarda (esnaflarda) geçici olarak saklamanıza olanak sağlayan bir platformdur.

2. Sorumluluklar
- Esnaf, kendisine teslim edilen eşyayı güvenli bir şekilde saklamakla yükümlüdür.
- Kullanıcı, yasaklı madde (yanıcı, patlayıcı, yasa dışı vb.) teslim etmemeyi taahhüt eder.

3. İptal ve İade
Rezervasyon saatinden önce yapılan iptallerde tam iade yapılır. Süre başladıktan sonra iade yapılmaz.
''';
}

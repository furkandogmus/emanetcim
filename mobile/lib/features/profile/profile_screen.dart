import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_controller.dart';
import '../../shared/models/user.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).session;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('Hesabım', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        children: [
          // Header Section
          Center(
            child: Column(
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF97316).withOpacity(0.1),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFF97316), width: 2),
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
                const SizedBox(height: 16),
                Text(
                  user?.name ?? 'Kullanıcı',
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  user?.email ?? '',
                  style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey.shade600),
                ),
                const SizedBox(height: 24),
                if (user?.role != UserRole.PARTNER)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Text(
                      'Bireysel Kullanıcı',
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.blue.shade700,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          
          const SizedBox(height: 32),
          // Referral Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20, offset: const Offset(0, 10)),
              ],
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), shape: BoxShape.circle),
                      child: const Icon(Icons.card_giftcard_rounded, color: Color(0xFFF97316), size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Arkadaşlarını Davet Et', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                          Text('Her davet için ₺20 indirim kazan!', style: GoogleFonts.outfit(color: Colors.grey.shade400, fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white12)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        user?.referralCode ?? 'BP-WELCOME',
                        style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18, letterSpacing: 2),
                      ),
                      TextButton.icon(
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: user?.referralCode ?? 'BP-WELCOME'));
                          HapticFeedback.mediumImpact();
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Referans kodu kopyalandı!')));
                        },
                        icon: const Icon(Icons.copy_rounded, size: 18, color: Color(0xFFF97316)),
                        label: Text('KOPYALA', style: GoogleFonts.outfit(color: const Color(0xFFF97316), fontWeight: FontWeight.bold, fontSize: 12)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 40),
          
          // Menu Section
          Text(
            'HESAP AYARLARI',
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade500,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 16),
          _menuItem(Icons.person_outline_rounded, 'Profilimi Düzenle', onTap: () => _showEditProfile(context, user)),
          _menuItem(Icons.notifications_none_rounded, 'Bildirimler', onTap: () => _showInfo(context, 'Bildirimler', 'Bildirim ayarlarınız çok yakında burada olacak!')),
          _menuItem(Icons.payment_rounded, 'Ödeme Yöntemlerim', onTap: () => _showInfo(context, 'Ödeme Yöntemleri', 'Kayıtlı kartlarınızın yönetimi bir sonraki güncellemede eklenecektir.')),
          
          const SizedBox(height: 32),
          
          Text(
            'DESTEK & HAKKINDA',
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade500,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 16),
          _menuItem(Icons.help_outline_rounded, 'Yardım Merkezi', onTap: () => _showLegal(context, 'Yardım Merkezi', 'BagajPark hakkında her türlü sorunuz için destek@bagajpark.com adresinden bize ulaşabilirsiniz.')),
          _menuItem(Icons.info_outline_rounded, 'Uygulama Hakkında', onTap: () => _showLegal(context, 'Uygulama Hakkında', 'BagajPark v1.0.0\nSeyahatlerinizi kolaylaştıran dijital emanet ağı.')),
          _menuItem(Icons.privacy_tip_outlined, 'Gizlilik Politikası', onTap: () => _showLegal(context, 'Gizlilik Politikası', 'Verileriniz BagajPark güvencesiyle uçtan uca korunmaktadır...')),
          
          const SizedBox(height: 48),
          
          // Logout Button
          OutlinedButton.icon(
            onPressed: () => _confirmLogout(context, ref),
            icon: const Icon(Icons.logout_rounded, size: 20),
            label: const Text('Çıkış Yap'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.redAccent,
              side: const BorderSide(color: Colors.redAccent, width: 1.5),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
          
          const SizedBox(height: 12),
          
          // Delete Account (Apple Requirement)
          TextButton(
            onPressed: () => _showDeleteAccount(context, ref),
            child: Text(
              'Hesabımı Kalıcı Olarak Sil',
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
              'Versiyon 1.0.0 (Build 1)',
              style: GoogleFonts.outfit(fontSize: 11, color: Colors.grey.shade400),
            ),
          ),
          
          const SizedBox(height: 100), // Nav bar için boşluk
        ],
      ),
    );
  }

  Widget _menuItem(IconData icon, String title, {required VoidCallback onTap}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: const Color(0xFF0F172A), size: 22),
        ),
        title: Text(
          title,
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: const Color(0xFF0F172A),
          ),
        ),
        trailing: Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Colors.grey.shade400),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
        title: Text('Çıkış Yap', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text('Hesabınızdan çıkış yapmak istediğinize emin misiniz?', style: GoogleFonts.outfit()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('İptal')),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(authControllerProvider.notifier).logout();
            },
            child: const Text('Çıkış Yap', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }

  void _showDeleteAccount(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Hesabı Sil', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.redAccent)),
        content: Text(
          'Hesabınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm rezervasyon verileriniz kalıcı olarak silinecektir.',
          style: GoogleFonts.outfit(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('İptal')),
          TextButton(
            onPressed: () {
              // In prod, call API to delete account
              Navigator.pop(context);
              ref.read(authControllerProvider.notifier).logout();
            },
            child: const Text('KALICI OLARAK SİL', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showEditProfile(BuildContext context, UserDto? user) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true, // Navigasyon barının üzerine çıkmasını sağlar
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Profili Düzenle', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            TextField(
              decoration: InputDecoration(labelText: 'Ad Soyad', border: OutlineInputBorder(borderRadius: BorderRadius.circular(16))),
              controller: TextEditingController(text: user?.name),
            ),
            const SizedBox(height: 16),
            TextField(
              decoration: InputDecoration(labelText: 'E-posta', border: OutlineInputBorder(borderRadius: BorderRadius.circular(16))),
              controller: TextEditingController(text: user?.email),
              readOnly: true,
            ),
            const SizedBox(height: 24),
            FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Güncelle')),
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
        title: Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text(msg, style: GoogleFonts.outfit()),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Tamam'))],
      ),
    );
  }

  void _showLegal(BuildContext context, String title, String content) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        expand: false,
        builder: (_, scroll) => Padding(
          padding: const EdgeInsets.all(24),
          child: ListView(
            controller: scroll,
            children: [
              Text(title, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              Text(content, style: GoogleFonts.outfit(height: 1.6)),
            ],
          ),
        ),
      ),
    );
  }
}

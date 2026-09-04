import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart' show FormData, MultipartFile;
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/auth/biometric_service.dart';
import '../../core/auth/token_store.dart';
import '../../core/config/theme_mode_provider.dart';
import '../../core/push/notification_prefs.dart';
import '../../core/services/haptic_service.dart';
import '../../core/services/share_service.dart';
import '../../core/utils/error_handler.dart';
import '../../shared/models/user.dart';
import '../../shared/utils/app_colors.dart';

final profileStatsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final dio = ref.read(dioProvider);
  final res = await dio.get('/profile/stats');
  return res.data as Map<String, dynamic>;
});

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _uploading = false;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;
  bool _biometricLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadBiometric();
  }

  Future<void> _loadBiometric() async {
    final biometric = ref.read(biometricServiceProvider);
    final available = await biometric.isAvailable;
    final enabled = await biometric.isEnabled;
    if (mounted) {
      setState(() {
        _biometricAvailable = available;
        _biometricEnabled = enabled;
        _biometricLoaded = true;
      });
    }
  }

  Future<void> _pickAndUploadAvatar() async {
    if (_uploading) return;
    final picker = ImagePicker();
    final image = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 80,
    );
    if (image == null) return;

    setState(() => _uploading = true);
    try {
      final dio = ref.read(dioProvider);
      final ext = image.name.split('.').last.toLowerCase();
      var mimeType = 'image/jpeg';
      if (ext == 'png') {
        mimeType = 'image/png';
      } else if (ext == 'webp') {
        mimeType = 'image/webp';
      }

      final formData = FormData.fromMap({
        'avatar': await MultipartFile.fromFile(
          image.path,
          filename: image.name,
          contentType: MediaType.parse(mimeType),
        ),
      });
      final res = await dio.put('/auth/me', data: formData);
      final newAvatarUrl = res.data['avatarUrl'] as String?;
      if (newAvatarUrl != null && mounted) {
        ref.invalidate(authControllerProvider);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(getErrorMessage(e, fallback: 'common.error'.tr())),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Widget _buildAvatar(UserDto? user) {
    final avatarUrl = user?.avatarUrl;
    final initial = (user?.name != null && user!.name!.isNotEmpty)
        ? user.name!.substring(0, 1).toUpperCase()
        : '?';

    return GestureDetector(
      onTap: _pickAndUploadAvatar,
      child: Stack(
        children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: AppColors.brandOrange.withValues(alpha: 0.1),
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.brandOrange, width: 2),
            ),
            child: _uploading
                ? const Center(
                    child: SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : (avatarUrl != null && avatarUrl.isNotEmpty)
                ? ClipOval(
                    child: CachedNetworkImage(
                      imageUrl: avatarUrl,
                      width: 96,
                      height: 96,
                      fit: BoxFit.cover,
                      placeholder: (_, _) => Center(
                        child: Text(
                          initial,
                          style: GoogleFonts.outfit(
                            fontSize: 40,
                            fontWeight: FontWeight.bold,
                            color: AppColors.brandOrange,
                          ),
                        ),
                      ),
                      errorWidget: (_, _, _) => Center(
                        child: Text(
                          initial,
                          style: GoogleFonts.outfit(
                            fontSize: 40,
                            fontWeight: FontWeight.bold,
                            color: AppColors.brandOrange,
                          ),
                        ),
                      ),
                    ),
                  )
                : Center(
                    child: Text(
                      initial,
                      style: GoogleFonts.outfit(
                        fontSize: 40,
                        fontWeight: FontWeight.bold,
                        color: AppColors.brandOrange,
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
                color: AppColors.brandOrange,
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
    );
  }

  @override
  Widget build(BuildContext context) {
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
                _buildAvatar(user),
                const SizedBox(height: 16),
                Text(
                  user?.name ?? 'profile.default_name'.tr(),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user?.email ?? '',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF424242),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),

          // Stats Section
          Consumer(
            builder: (context, ref, child) {
              final statsAsync = ref.watch(profileStatsProvider);
              return statsAsync.when(
                data: (stats) => Row(
                  children: [
                    _statItem(
                      '${stats['totalBookings'] ?? 0}',
                      'profile.stats_bookings'.tr(),
                    ),
                    _statItem(
                      '₺${stats['totalSavings'] ?? '0'}',
                      'profile.stats_savings'.tr(),
                    ),
                    _statItem(
                      '${stats['completedBookings'] ?? 0}',
                      'profile.stats_favorites'.tr(),
                    ),
                  ],
                ),
                loading: () => Row(
                  children: [
                    _statItem('...', 'profile.stats_bookings'.tr()),
                    _statItem('...', 'profile.stats_savings'.tr()),
                    _statItem('...', 'profile.stats_favorites'.tr()),
                  ],
                ),
                error: (_, _) => Row(
                  children: [
                    _statItem('-', 'profile.stats_bookings'.tr()),
                    _statItem('-', 'profile.stats_savings'.tr()),
                    _statItem('-', 'profile.stats_favorites'.tr()),
                  ],
                ),
              );
            },
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
          if (!isPartner) ...[
            _referralCard(context, ref, user),
            const SizedBox(height: 32),
          ],

          // Menu Section
          _sectionHeader('profile.settings'.tr()),
          _menuItem(
            Icons.person_outline_rounded,
            'profile.edit_profile'.tr(),
            onTap: () => _showEditProfile(context, ref, user),
          ),
          _menuItem(
            Icons.notifications_none_rounded,
            'profile.notifications'.tr(),
            onTap: () => _showNotificationPrefs(context),
          ),
          const SizedBox(height: 8),
          _themeToggle(context),
          const SizedBox(height: 8),
          _biometricToggle(context),

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
            onTap: () => _showLegal(
              context,
              'profile.privacy'.tr(),
              'profile.privacy_content'.tr(),
            ),
          ),
          _menuItem(
            Icons.gavel_rounded,
            'profile.terms_of_service'.tr(),
            onTap: () => _showLegal(
              context,
              'profile.terms_of_service'.tr(),
              'profile.terms_content'.tr(),
            ),
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
                color: const Color(0xFF757575),
                fontSize: 13,
                decoration: TextDecoration.underline,
              ),
            ),
          ),

          const SizedBox(height: 32),

          Center(
            child: Text(
              'profile.version'.tr(args: ['1.0.0']),
              style: GoogleFonts.outfit(
                fontSize: 11,
                color: const Color(0xFF757575),
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
          color: const Color(0xFF616161),
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _referralCard(BuildContext context, WidgetRef ref, UserDto? user) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.textDark, Color(0xFF1E293B)],
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
                  color: AppColors.brandOrange,
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
                        color: const Color(0xFF757575),
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
              children: [
                Flexible(
                  child: Text(
                    user?.referralCode ?? 'BP-WELCOME',
                    style: GoogleFonts.outfit(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      letterSpacing: 1,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                TextButton.icon(
                  onPressed: () {
                    ref.read(hapticServiceProvider).light();
                    Clipboard.setData(
                      ClipboardData(text: user?.referralCode ?? 'BP-WELCOME'),
                    );
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('profile.copied'.tr())),
                    );
                  },
                  icon: const Icon(
                    Icons.copy_rounded,
                    size: 16,
                    color: AppColors.brandOrange,
                  ),
                  label: Text(
                    'profile.copy'.tr(),
                    style: GoogleFonts.outfit(
                      color: AppColors.brandOrange,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
                const SizedBox(width: 4),
                IconButton(
                  onPressed: () {
                    ref.read(hapticServiceProvider).selection();
                    ref.read(shareServiceProvider).shareApp();
                  },
                  icon: const Icon(
                    Icons.share_rounded,
                    size: 18,
                    color: Colors.white70,
                  ),
                  constraints: const BoxConstraints(),
                  padding: const EdgeInsets.all(8),
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
        leading: Icon(icon, color: AppColors.textDark, size: 22),
        title: Text(
          title,
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: AppColors.textDark,
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

  Widget _themeToggle(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        tileColor: Colors.white,
        leading: Icon(
          ref.watch(themeModeProvider) == ThemeMode.dark
              ? Icons.dark_mode_rounded
              : Icons.light_mode_rounded,
          color: AppColors.textDark,
          size: 22,
        ),
        title: Text(
          'profile.theme'.tr(),
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: AppColors.textDark,
          ),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        onTap: () {
          HapticFeedback.lightImpact();
          _showThemePicker(context);
        },
      ),
    );
  }

  void _showThemePicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'profile.theme'.tr(),
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 24),
              ListTile(
                leading: const Icon(Icons.phone_android_rounded),
                title: Text('profile.auto'.tr()),
                trailing: ref.watch(themeModeProvider) == ThemeMode.system
                    ? const Icon(Icons.check, color: AppColors.brandOrange)
                    : null,
                onTap: () {
                  ref
                      .read(themeModeProvider.notifier)
                      .setMode(ThemeMode.system);
                  Navigator.pop(ctx);
                },
              ),
              ListTile(
                leading: const Icon(Icons.light_mode_rounded),
                title: Text('profile.light_mode'.tr()),
                trailing: ref.watch(themeModeProvider) == ThemeMode.light
                    ? const Icon(Icons.check, color: AppColors.brandOrange)
                    : null,
                onTap: () {
                  ref.read(themeModeProvider.notifier).setMode(ThemeMode.light);
                  Navigator.pop(ctx);
                },
              ),
              ListTile(
                leading: const Icon(Icons.dark_mode_rounded),
                title: Text('profile.dark_mode'.tr()),
                trailing: ref.watch(themeModeProvider) == ThemeMode.dark
                    ? const Icon(Icons.check, color: AppColors.brandOrange)
                    : null,
                onTap: () {
                  ref.read(themeModeProvider.notifier).setMode(ThemeMode.dark);
                  Navigator.pop(ctx);
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _biometricToggle(BuildContext context) {
    if (!_biometricLoaded || !_biometricAvailable) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        tileColor: Colors.white,
        leading: const Icon(
          Icons.fingerprint_rounded,
          color: AppColors.textDark,
          size: 22,
        ),
        title: Text(
          'profile.biometric'.tr(),
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: AppColors.textDark,
          ),
        ),
        subtitle: Text(
          'profile.biometric_desc'.tr(),
          style: GoogleFonts.outfit(
            fontSize: 12,
            color: const Color(0xFF616161),
          ),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        onTap: () => _handleBiometricToggle(!_biometricEnabled),
        trailing: Switch(
          value: _biometricEnabled,
          activeThumbColor: AppColors.brandOrange,
          onChanged: _handleBiometricToggle,
        ),
      ),
    );
  }

  Future<void> _handleBiometricToggle(bool val) async {
    setState(() => _biometricEnabled = val);
    try {
      if (val) {
        final ok = await ref
            .read(biometricServiceProvider)
            .authenticate(reason: 'profile.biometric_reason'.tr());
        if (ok) {
          await ref.read(biometricServiceProvider).setEnabled(true);
          final store = ref.read(tokenStoreProvider);
          final rt = await store.readRefreshToken();
          final user = ref.read(authControllerProvider).session;
          if (rt != null && user?.email != null) {
            await store.saveBiometricAccount(user!.email!, rt);
          }
        } else {
          await ref.read(biometricServiceProvider).setEnabled(false);
          if (mounted) setState(() => _biometricEnabled = false);
        }
      } else {
        await ref.read(biometricServiceProvider).setEnabled(false);
        final user = ref.read(authControllerProvider).session;
        if (user?.email != null) {
          await ref
              .read(tokenStoreProvider)
              .removeBiometricAccount(user!.email!);
        }
      }
    } catch (_) {
      await ref.read(biometricServiceProvider).setEnabled(false);
      if (mounted) setState(() => _biometricEnabled = false);
    }
  }

  void _showNotificationPrefs(BuildContext context) {
    final prefs = ref.read(notificationPrefsProvider);
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'profile.notifications'.tr(),
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 24),
              SwitchListTile(
                title: const Text('Rezervasyon Güncellemeleri'),
                subtitle: Text(
                  'Onay, check-in, check-out ve QR kod bildirimleri',
                  style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey),
                ),
                value: prefs.bookingUpdates,
                activeThumbColor: AppColors.brandOrange,
                onChanged: (v) => ref
                    .read(notificationPrefsProvider.notifier)
                    .setBookingUpdates(v),
              ),
              const Divider(),
              SwitchListTile(
                title: const Text('Kampanya & İndirim'),
                subtitle: Text(
                  'Özel indirimler, kampanya duyuruları ve promosyon kodları',
                  style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey),
                ),
                value: prefs.promotions,
                activeThumbColor: AppColors.brandOrange,
                onChanged: (v) => ref
                    .read(notificationPrefsProvider.notifier)
                    .setPromotions(v),
              ),
              const Divider(),
              SwitchListTile(
                title: const Text('Esnaf Uyarıları'),
                subtitle: Text(
                  'Yeni rezervasyon, mesaj ve acil durum bildirimleri',
                  style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey),
                ),
                value: prefs.partnerAlerts,
                activeThumbColor: AppColors.brandOrange,
                onChanged: (v) => ref
                    .read(notificationPrefsProvider.notifier)
                    .setPartnerAlerts(v),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
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
          'profile.logout_confirm'.tr(),
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

  void _showEditProfile(BuildContext context, WidgetRef ref, UserDto? user) {
    final nameController = TextEditingController(text: user?.name);
    var isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
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
                controller: nameController,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: isSaving
                    ? null
                    : () async {
                        setModalState(() => isSaving = true);
                        try {
                          final dio = ref.read(dioProvider);
                          await dio.put(
                            '/auth/me',
                            data: {'name': nameController.text},
                          );
                          if (context.mounted) {
                            ref.invalidate(authControllerProvider);
                            Navigator.pop(context);
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  getErrorMessage(
                                    e,
                                    fallback: 'common.error'.tr(),
                                  ),
                                ),
                              ),
                            );
                          }
                        } finally {
                          if (context.mounted) {
                            setModalState(() => isSaving = false);
                          }
                        }
                      },
                child: isSaving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text('common.confirm'.tr()),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
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
              color: AppColors.textDark,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 12,
              color: const Color(0xFF616161),
            ),
          ),
        ],
      ),
    );
  }
}

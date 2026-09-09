import 'package:flutter/material.dart';

/// Ortak "bos liste / bos sonuc" gorunumu. Ikon + baslik + aciklama +
/// istege bagli aksiyon dugmesinden olusur; tum renkler
/// `Theme.of(context)` uzerinden gelir (dark mode dahil), hardcoded renk
/// TASIMAZ. Ekrana ozgu metin/aksiyon caginin sorumlulugudur -- bu widget
/// yalnizca gorsel/yapisal iskeleti standardize eder.
///
/// Kullanim:
/// ```dart
/// EmptyState(
///   icon: Icons.luggage_outlined,
///   title: 'booking.no_bookings'.tr(),
///   description: 'booking.no_bookings_desc'.tr(),
///   actionLabel: 'booking.start_exploring'.tr(),
///   actionIcon: Icons.search_rounded,
///   onAction: () => context.go('/'),
/// )
/// ```
class EmptyState extends StatelessWidget {
  const EmptyState({
    required this.icon,
    required this.title,
    this.description,
    this.actionLabel,
    this.onAction,
    this.actionIcon,
    this.accentColor,
    super.key,
  });

  /// Dairesel arka plan icindeki ikon (illustrasyon yerine gecer).
  final IconData icon;

  /// Baslik metni; cagiran taraf zaten `.tr()` ile cevirmis olmali.
  final String title;

  /// Ikinci satir aciklama; opsiyonel.
  final String? description;

  /// Aksiyon dugmesinin etiketi. `onAction` ile birlikte verilmelidir.
  final String? actionLabel;

  /// Aksiyon dugmesine basildiginda calisir. `null` ise dugme cizilmez.
  final VoidCallback? onAction;

  /// Aksiyon dugmesinin ikonu (opsiyonel, `FilledButton.icon` uretir).
  final IconData? actionIcon;

  /// Ikon rengi override; verilmezse `colorScheme.primary` kullanilir.
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = accentColor ?? theme.colorScheme.primary;
    final showAction = actionLabel != null && onAction != null;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 64, color: color),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.onSurface,
              ),
            ),
            if (description != null) ...[
              const SizedBox(height: 8),
              Text(
                description!,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            if (showAction) ...[
              const SizedBox(height: 32),
              actionIcon != null
                  ? FilledButton.icon(
                      onPressed: onAction,
                      icon: Icon(actionIcon),
                      label: Text(actionLabel!),
                    )
                  : FilledButton(
                      onPressed: onAction,
                      child: Text(actionLabel!),
                    ),
            ],
          ],
        ),
      ),
    );
  }
}

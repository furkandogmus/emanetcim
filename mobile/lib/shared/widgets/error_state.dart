import 'package:flutter/material.dart';

/// Ortak "hata" gorunumu. Ikon + baslik + aciklama + istege bagli
/// "tekrar dene" dugmesinden olusur; tum renkler `Theme.of(context)`
/// uzerinden gelir (dark mode dahil), hardcoded renk TASIMAZ. Ekrana ozgu
/// metin/aksiyon caginin sorumlulugudur -- bu widget yalnizca
/// gorsel/yapisal iskeleti standardize eder.
///
/// Kullanim:
/// ```dart
/// ErrorState(
///   title: 'common.error'.tr(),
///   actionLabel: 'common.try_again'.tr(),
///   onAction: () => ref.refresh(myBookingsProvider.future),
/// )
/// ```
class ErrorState extends StatelessWidget {
  const ErrorState({
    required this.title,
    this.description,
    this.actionLabel,
    this.onAction,
    this.icon = Icons.error_outline_rounded,
    super.key,
  });

  /// Baslik metni; cagiran taraf zaten `.tr()` ile cevirmis olmali.
  final String title;

  /// Ikinci satir aciklama; opsiyonel.
  final String? description;

  /// "Tekrar dene" dugmesinin etiketi. `onAction` ile birlikte verilmelidir.
  final String? actionLabel;

  /// Dugmeye basildiginda calisir (orn. `ref.refresh(...)`). `null` ise
  /// dugme cizilmez.
  final VoidCallback? onAction;

  /// Dairesel arka plan icindeki ikon.
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = theme.colorScheme.error;
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
              const SizedBox(height: 24),
              TextButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

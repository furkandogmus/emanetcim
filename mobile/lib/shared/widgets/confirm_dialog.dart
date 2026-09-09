import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Standart onay/bilgi dialogu.
///
/// Proje kuralı (kök `CLAUDE.md`): "Yıkıcı onay için `ConfirmDialog`" — ham
/// `AlertDialog` + tekrarlanan stil yerine tüm ekranlar bunu kullanır. Şekil
/// ve düz (elevation 0) görünüm `ThemeData.dialogTheme`'den gelir
/// (`mobile/lib/app/theme.dart`), burada sadece içerik/renk mantığı var.
class ConfirmDialog extends StatelessWidget {
  const ConfirmDialog({
    required this.title,
    required this.confirmLabel,
    this.message,
    this.content,
    this.cancelLabel,
    this.destructive = false,
    this.icon,
    super.key,
  }) : assert(
         message != null || content != null,
         'ConfirmDialog: message veya content sağlanmalı',
       );

  /// Dialog başlığı.
  final String title;

  /// Düz metin içerik. `content` verilmezse kullanılır.
  final String? message;

  /// Özel içerik widget'ı (ör. satır satır bilgi listesi). Verilirse
  /// [message] yok sayılır.
  final Widget? content;

  /// İptal butonu etiketi. `null` verilirse tek butonlu bilgi dialogu olur
  /// (ör. taramada mühür bilgisi göstermek gibi).
  final String? cancelLabel;

  /// Onay/kapat butonu etiketi.
  final String confirmLabel;

  /// `true` ise başlık ve onay butonu `colorScheme.error` ile vurgulanır
  /// (hesap silme, çıkış yapma gibi geri alınamaz işlemler için).
  final bool destructive;

  /// Başlığın yanına opsiyonel ikon.
  final IconData? icon;

  /// Dialogu gösterir; onaylanırsa `true`, iptal/dışarı tıklama ile
  /// kapatılırsa `false`/`null` döner.
  static Future<bool?> show(
    BuildContext context, {
    required String title,
    required String confirmLabel,
    String? message,
    Widget? content,
    String? cancelLabel,
    bool destructive = false,
    IconData? icon,
    bool barrierDismissible = true,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: barrierDismissible,
      builder: (context) => ConfirmDialog(
        title: title,
        message: message,
        content: content,
        cancelLabel: cancelLabel,
        confirmLabel: confirmLabel,
        destructive: destructive,
        icon: icon,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final accentColor = destructive ? colorScheme.error : null;

    return AlertDialog(
      title: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, color: accentColor ?? colorScheme.primary),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Text(
              title,
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold,
                color: accentColor,
              ),
            ),
          ),
        ],
      ),
      content: content ?? Text(message!, style: GoogleFonts.outfit()),
      actions: [
        if (cancelLabel != null)
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(cancelLabel!),
          ),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          child: Text(
            confirmLabel,
            style: GoogleFonts.outfit(
              fontWeight: FontWeight.bold,
              color: accentColor,
            ),
          ),
        ),
      ],
    );
  }
}

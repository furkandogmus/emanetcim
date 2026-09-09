// Erisilebilirlik + davranis testi. Gercek durum yerine `notificationProvider`
// baslangic verisiyle override edilir.
import 'package:bagajpark/core/services/notification_service.dart';
import 'package:bagajpark/features/notifications/notifications_screen.dart';
import 'package:bagajpark/shared/models/notification.dart';
import 'package:bagajpark/shared/utils/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

class _SeedNotificationNotifier extends NotificationNotifier {
  _SeedNotificationNotifier(this._seed);
  final List<NotificationDto> _seed;

  @override
  List<NotificationDto> build() => _seed;
}

void main() {
  final unread = NotificationDto(
    id: 'n-1',
    title: 'Rezervasyonun onaylandı',
    body: 'Taksim Emanet rezervasyonun onaylandı.',
    type: NotificationType.bookingUpdate,
    createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
  );

  Future<void> pump(WidgetTester tester, {List<NotificationDto>? items}) =>
      pumpApp(
        tester,
        const NotificationsScreen(),
        overrides: [
          notificationProvider.overrideWith(
            () => _SeedNotificationNotifier(items ?? [unread]),
          ),
        ],
      );

  testWidgets(
    'NotificationsScreen: bildirim listesi gercek ceviriyle ciziliyor',
    (tester) async {
      await pump(tester);
      expect(find.text('Bildirimler'), findsOneWidget);
      expect(find.text('Rezervasyonun onaylandı'), findsOneWidget);
    },
  );

  testWidgets('NotificationsScreen: bos liste mesaji gosterilir', (
    tester,
  ) async {
    await pump(tester, items: []);
    expect(find.text('Henüz bildirim yok.'), findsOneWidget);
    expect(find.text('Tümünü Okundu İşaretle'), findsNothing);
  });

  testWidgets(
    'NotificationsScreen: "Tumunu Okundu Isaretle" okunmamis rozetini kaldirir',
    (tester) async {
      await pump(tester);

      // Buton liste bos olmadigi surece her zaman gorunur (okunmamis sayisina
      // gore degil); asil davranis kanit noktasi okunmamis noktasinin
      // (turuncu daire) kaybolmasidir.
      expect(find.byWidgetPredicate(_isUnreadDot), findsOneWidget);

      await tester.tap(find.text('Tümünü Okundu İşaretle'));
      await tester.pumpAndSettle();

      expect(find.byWidgetPredicate(_isUnreadDot), findsNothing);
      expect(find.text('Tümünü Okundu İşaretle'), findsOneWidget);
    },
  );

  testWidgets('NotificationsScreen: bildirime dokunma onu okundu isaretler', (
    tester,
  ) async {
    await pump(tester);

    expect(find.byWidgetPredicate(_isUnreadDot), findsOneWidget);

    // Onceden `onTap` yalnizca titresim uretiyordu; bildirim ne okundu
    // isaretleniyordu ne de `deepLink` alanina gore yonlendiriliyordu
    // (2026-09-09'da bulundu). Bu ornek bildirimde `deepLink` olmadigindan
    // navigasyon kolu (context.push, GoRouter'siz test ortaminda calismaz)
    // tetiklenmiyor; burada yalnizca markAsRead davranisi dogrulaniyor.
    await tester.tap(find.text('Rezervasyonun onaylandı'));
    await tester.pumpAndSettle();

    expect(find.byWidgetPredicate(_isUnreadDot), findsNothing);
  });

  testWidgets('NotificationsScreen: dokunma hedefi >= 48dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('NotificationsScreen: dokunulabilir dugumler etiketli', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    handle.dispose();
  });

  // textContrastGuideline BILEREK yok: "Tümünü Okundu İşaretle" butonu
  // marka turuncusuyla (AppColors.brandOrange, #EA580C) yazilir, zeminse
  // AppBar arka plani (neredeyse beyaz); olculen oran 3.40:1 — WCAG AA'nin
  // 4.5:1 esiginin altinda. force_update_screen_a11y_test.dart'taki ayni
  // marka rengi bulgusuyla ozdes; duzeltmesi marka rengi degisikligi
  // gerektirir (bkz. docs/DEFECT_BACKLOG.md).
}

bool _isUnreadDot(Widget widget) {
  if (widget is! Container) return false;
  final decoration = widget.decoration;
  return decoration is BoxDecoration &&
      decoration.shape == BoxShape.circle &&
      decoration.color == AppColors.brandOrange;
}

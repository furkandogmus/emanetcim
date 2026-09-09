import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/features/admin/admin_controller.dart';
import 'package:bagajpark/features/admin/admin_dashboard_screen.dart';
import 'package:bagajpark/shared/models/admin_stats.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/pump_app.dart';

void main() {
  AdminStatsDto stats() => const AdminStatsDto(
    totalBookings: 42,
    totalRevenue: 1500,
    totalPartners: 8,
    pendingApplications: 3,
    unreadMessages: 5,
  );

  testWidgets('istatistik kartlarini ve hizli islemleri gosterir', (
    tester,
  ) async {
    await pumpApp(
      tester,
      child: const AdminDashboardScreen(),
      overrides: [adminStatsProvider.overrideWith((ref) async => stats())],
      extraRoutes: {
        '/admin/applications': (context) =>
            const Scaffold(body: Text('basvurular-stub')),
        '/admin/messages': (context) =>
            const Scaffold(body: Text('mesajlar-stub')),
      },
    );
    await tester.pumpAndSettle();

    expect(find.text('Yönetim Paneli'), findsOneWidget);
    expect(find.text('42'), findsOneWidget); // toplam rezervasyon
    expect(find.text('₺1500'), findsOneWidget); // toplam gelir
    expect(find.text('8'), findsOneWidget); // aktif esnaf
    expect(find.text('3'), findsOneWidget); // bekleyen basvuru
  });

  testWidgets('onayla basvurular karti tiklandiginda basvuru ekranina gider', (
    tester,
  ) async {
    await pumpApp(
      tester,
      child: const AdminDashboardScreen(),
      overrides: [adminStatsProvider.overrideWith((ref) async => stats())],
      extraRoutes: {
        '/admin/applications': (context) =>
            const Scaffold(body: Text('basvurular-stub')),
        '/admin/messages': (context) =>
            const Scaffold(body: Text('mesajlar-stub')),
      },
    );
    await tester.pumpAndSettle();

    // Hizli islemler karti ListView'in altinda; ekran yuksekligine gore
    // gorunur alanda olmayabilir (ListView sadece viewport+cache icindeki
    // cocuklari agaca ekliyor), o yuzden once gorunur hale getiriyoruz.
    // `dragUntilVisible` sadece agaca eklenmesini garanti ediyor, tam olarak
    // viewport icine ortalamiyor — ekstra bir kaydirma ile gercekten
    // dokunulabilir hale getiriyoruz.
    await tester.dragUntilVisible(
      find.text('Başvuruları Onayla'),
      find.byType(ListView),
      const Offset(0, -200),
    );
    await tester.drag(find.byType(ListView), const Offset(0, -150));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Başvuruları Onayla'));
    await tester.pumpAndSettle();

    expect(find.text('basvurular-stub'), findsOneWidget);
  });

  testWidgets('cikis yap onay dialogu ile oturumu kapatir', (tester) async {
    final controller = FakeAuthController(const AuthState());
    await pumpApp(
      tester,
      child: const AdminDashboardScreen(),
      overrides: [
        adminStatsProvider.overrideWith((ref) async => stats()),
        authControllerProvider.overrideWith(() => controller),
      ],
      extraRoutes: {
        '/admin/applications': (context) =>
            const Scaffold(body: Text('basvurular-stub')),
        '/admin/messages': (context) =>
            const Scaffold(body: Text('mesajlar-stub')),
      },
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.logout_rounded));
    await tester.pumpAndSettle();

    // Onay diyalogu iceriginin gorunmesi (widget tipinden bagimsiz —
    // ConfirmDialog'a tasinmasi ihtimaline karsi metne gore dogruluyoruz).
    expect(
      find.text('Hesabınızdan çıkış yapmak istediğinize emin misiniz?'),
      findsOneWidget,
    );

    await tester.tap(find.text('Çıkış Yap').last);
    await tester.pumpAndSettle();

    expect(controller.state.session, isNull);
  });
}

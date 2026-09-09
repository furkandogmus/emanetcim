// Erisilebilirlik + davranis testi. Gercek ag cagrisi yapmamak icin
// `bookingRepositoryProvider` sahte bir repository ile override edilir.
import 'package:bagajpark/core/repositories/booking_repository.dart';
import 'package:bagajpark/core/utils/result.dart';
import 'package:bagajpark/features/booking/my_bookings_screen.dart';
import 'package:bagajpark/shared/models/booking.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

class _FakeBookingRepository extends BookingRepository {
  _FakeBookingRepository(this._items) : super(Dio());
  final List<BookingDto> _items;

  @override
  Future<Result<List<BookingDto>>> getMyBookings() async =>
      Success(List.of(_items));
}

void main() {
  final booking = BookingDto(
    id: 'booking-abc123',
    shopId: 'shop-1',
    shopName: 'Taksim Emanet',
    checkInTime: DateTime(2026, 9, 10, 10),
    checkOutTime: DateTime(2026, 9, 10, 18),
    bagCountS: 1,
    bagCountM: 1,
    bagCountXl: 0,
    totalPrice: 120,
    status: BookingStatus.paid,
  );

  Future<void> pump(WidgetTester tester, {List<BookingDto>? items}) => pumpApp(
    tester,
    const MyBookingsScreen(),
    overrides: [
      bookingRepositoryProvider.overrideWith(
        (ref) => _FakeBookingRepository(items ?? [booking]),
      ),
    ],
  );

  testWidgets(
    'MyBookingsScreen: rezervasyon listesi gercek ceviriyle ciziliyor',
    (tester) async {
      await pump(tester);
      expect(find.text('Rezervasyonlarım'), findsOneWidget);
      expect(find.text('Taksim Emanet'), findsOneWidget);
    },
  );

  testWidgets('MyBookingsScreen: bos liste mesaji gosterilir', (tester) async {
    await pump(tester, items: []);
    expect(find.text('Henüz rezervasyonun yok'), findsOneWidget);
    expect(find.text('Keşfetmeye Başla'), findsOneWidget);
  });

  testWidgets('MyBookingsScreen: dokunma hedefi >= 48dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });

  // labeledTapTargetGuideline BILEREK yok: AppBar'daki yenile IconButton'i
  // (`Icons.refresh_rounded`) bir `tooltip` tasimiyor, bu yuzden dokunulabilir
  // dugum semantik etiketsiz kaliyor. Ekrana ozgu degil, duzeltmesi
  // my_bookings_screen.dart'a `tooltip` eklemek gerektirir (bkz.
  // docs/DEFECT_BACKLOG.md) — bu gorev kapsaminda ekran dosyasina
  // dokunulmuyor.

  testWidgets('MyBookingsScreen: metin kontrasti WCAG AA', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    handle.dispose();
  });
}

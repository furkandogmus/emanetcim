// Regresyon: "Toplam Kazanç" özet kartı, henüz onaylanmamış (waitingApproval)
// veya onaylanıp valiz teslim alınmamış (approved/paid) rezervasyonların
// tutarını da kazanç sayıyordu (`status != cancelled` filtresi çok
// geniştir). Yalnızca fiilen teslim alınmış/edilmiş (checkedIn/checkedOut)
// durumlar gerçekleşmiş bir kazançtır.
import 'package:bagajpark/core/repositories/booking_repository.dart';
import 'package:bagajpark/core/utils/result.dart';
import 'package:bagajpark/features/partner/partner_bookings_screen.dart';
import 'package:bagajpark/shared/models/booking.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/pump_app.dart';

class _FakeBookingRepository extends BookingRepository {
  _FakeBookingRepository(this._bookings) : super(Dio());
  final List<BookingDto> _bookings;

  @override
  Future<Result<List<BookingDto>>> getPartnerBookings() async =>
      Success(_bookings);
}

BookingDto _booking({
  required String id,
  required BookingStatus status,
  required double totalPrice,
}) => BookingDto(
  id: id,
  shopId: 'shop-1',
  shopName: 'Test Dukkan',
  checkInTime: DateTime(2026, 9, 1, 10),
  checkOutTime: DateTime(2026, 9, 1, 18),
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  totalPrice: totalPrice,
  status: status,
);

void main() {
  testWidgets(
    'toplam kazanc yalnizca teslim alinmis/edilmis rezervasyonlari sayar',
    (tester) async {
      final bookings = [
        _booking(
          id: 'b-waiting',
          status: BookingStatus.waitingApproval,
          totalPrice: 500,
        ),
        _booking(
          id: 'b-approved',
          status: BookingStatus.approved,
          totalPrice: 300,
        ),
        _booking(
          id: 'b-checked-in',
          status: BookingStatus.checkedIn,
          totalPrice: 200,
        ),
        _booking(
          id: 'b-checked-out',
          status: BookingStatus.checkedOut,
          totalPrice: 100,
        ),
        _booking(
          id: 'b-cancelled',
          status: BookingStatus.cancelled,
          totalPrice: 999,
        ),
      ];

      await pumpApp(
        tester,
        child: const PartnerBookingsScreen(),
        overrides: [
          bookingRepositoryProvider.overrideWith(
            (ref) => _FakeBookingRepository(bookings),
          ),
        ],
      );
      await tester.pumpAndSettle();

      // Sadece checkedIn (200) + checkedOut (100) = 300 sayilmali; henuz
      // onaylanmamis/teslim alinmamis 500+300 ve iptal edilen 999 dahil
      // DEGIL.
      expect(find.text('₺300'), findsOneWidget);
      expect(find.text('₺1100'), findsNothing);
    },
  );
}

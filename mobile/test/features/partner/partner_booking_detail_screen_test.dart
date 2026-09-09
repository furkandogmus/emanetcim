// Regresyon: basarili check-in/check-out/onayla/reddet/bagaj-revizyonu
// mutasyonlari yalnizca `bookingProvider(b.id)`'i invalidate ediyordu,
// `partnerBookingsProvider`'i (liste ekrani) hic invalidate etmiyordu.
// Esnaf detaydan listeye geri dondugunde rezervasyonun eski durumunu ve
// eski "Toplam Kazanc" ozetini goruyordu.
import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/repositories/booking_repository.dart';
import 'package:bagajpark/core/utils/result.dart';
import 'package:bagajpark/features/partner/partner_booking_detail_screen.dart';
import 'package:bagajpark/features/partner/partner_bookings_screen.dart';
import 'package:bagajpark/shared/models/booking.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/pump_app.dart';

class _CountingBookingRepository extends BookingRepository {
  _CountingBookingRepository(this._detail, this._list) : super(Dio());
  final BookingDto _detail;
  final List<BookingDto> _list;
  int partnerFetchCount = 0;

  @override
  Future<Result<BookingDto>> getById(String id) async => Success(_detail);

  @override
  Future<Result<List<BookingDto>>> getPartnerBookings() async {
    partnerFetchCount++;
    return Success(_list);
  }
}

/// Gercek uygulamada `ShellRoute`, liste ekranini (ve dolayisiyla
/// `partnerBookingsProvider`'i izleyen bir dinleyiciyi) detay ekranina
/// gecerken de canli tutuyor. Burada ayni kosulu, saglanan `child`'i bir
/// `Consumer` ile sararak yeniden uretiyoruz.
class _KeepListAliveHost extends StatelessWidget {
  const _KeepListAliveHost({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) {
        ref.watch(partnerBookingsProvider);
        return child;
      },
    );
  }
}

BookingDto _approvedBooking() => BookingDto(
  id: 'b-1',
  shopId: 'shop-1',
  shopName: 'Test Dukkan',
  checkInTime: DateTime(2026, 9, 1, 10),
  checkOutTime: DateTime(2026, 9, 1, 18),
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  totalPrice: 100,
  status: BookingStatus.approved,
);

void main() {
  testWidgets(
    'basarili check-in sonrasi partner liste sayfasi da invalidate edilir',
    (tester) async {
      final repo = _CountingBookingRepository(_approvedBooking(), const []);

      await pumpApp(
        tester,
        child: const _KeepListAliveHost(
          child: PartnerBookingDetailScreen(bookingId: 'b-1'),
        ),
        overrides: [
          bookingRepositoryProvider.overrideWith((ref) => repo),
          dioProvider.overrideWith(
            (ref) => fakeDio((options) {
              expect(options.path, '/bookings/b-1/check-in');
              return null;
            }),
          ),
        ],
      );
      await tester.pumpAndSettle();

      // `_KeepListAliveHost` ilk build'de partnerBookingsProvider'i okumus
      // olmali.
      expect(repo.partnerFetchCount, 1);

      await tester.tap(find.text('Valizleri Teslim Al (Check-in)'));
      await tester.pumpAndSettle();

      // Check-in basarili olunca liste de invalidate edilip yeniden
      // cekilmis olmali -- aksi halde esnaf listeye donunce eski durumu
      // gorur.
      expect(repo.partnerFetchCount, 2);

      // `_pollingTimer` (Timer.periodic) widget dispose olmadan test
      // bitmemeli, aksi halde flutter_test "A Timer is still pending"
      // hatasi verir.
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    },
  );
}

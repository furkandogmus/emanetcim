// Regresyon testi: booking_detail_screen.dart'taki 10sn'lik polling zamanlayicisi
// yalnizca bookingProvider'i invalidate ediyordu; bookingSealsProvider hic
// yenilenmiyordu ve autoDispose olmadigi icin ekrandan cikilip tekrar girilse
// bile bayat kaliyordu. Esnaf check-in yapip muhur taktiginda, rezervasyon
// durumu (status) 10sn icinde guncelleniyor ama muhur numaralari asla
// gorunmuyordu -- kullanici uygulamayi tamamen kapatana kadar.
//
// `bookingRepositoryProvider` (rezervasyon/durum) ve `dioProvider` (muhurler,
// `bookingSealsProvider`'in dogrudan kullandigi) ayri ayri sahtelenip, esnafin
// check-in yapmasi bir durum degisikligi olarak simule ediliyor.
import 'dart:convert' show jsonEncode;

import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/repositories/booking_repository.dart';
import 'package:bagajpark/core/utils/result.dart';
import 'package:bagajpark/features/booking/booking_detail_screen.dart';
import 'package:bagajpark/shared/models/booking.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

class _MutableBookingState {
  _MutableBookingState(this.booking);
  BookingDto booking;
  List<Map<String, dynamic>> seals = const [];
}

class _FakeBookingRepository extends BookingRepository {
  _FakeBookingRepository(this._state) : super(Dio());
  final _MutableBookingState _state;

  @override
  Future<Result<BookingDto>> getById(String id) async =>
      Success(_state.booking);
}

/// `bookingSealsProvider` `dioProvider`'i DOGRUDAN kullaniyor (repository
/// katmanindan gecmiyor); bu yuzden gercek ag yerine sahte bir
/// [HttpClientAdapter] ile `GET /bookings/:id` yaniti sahteleniyor.
class _SealsAdapter implements HttpClientAdapter {
  _SealsAdapter(this._state);
  final _MutableBookingState _state;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final body = jsonEncode({'seals': _state.seals});
    return ResponseBody.fromString(
      body,
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  final booking = BookingDto(
    id: 'b1',
    shopId: 'shop-1',
    shopName: 'Taksim Emanet',
    checkInTime: DateTime(2026, 1, 1, 10),
    checkOutTime: DateTime(2026, 1, 1, 18),
    bagCountS: 0,
    bagCountM: 1,
    bagCountXl: 0,
    totalPrice: 50,
    status: BookingStatus.approved,
  );

  const screenProtectorChannel = MethodChannel('screen_protector');

  testWidgets('BookingDetailScreen: 10sn polling muhurleri de yeniliyor', (
    tester,
  ) async {
    // Ekran initState'te ScreenProtector (native MethodChannel) cagiriyor;
    // test ortaminda plugin kayitli degil, mock handler olmadan
    // MissingPluginException firlatir.
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      screenProtectorChannel,
      (call) async => null,
    );
    addTearDown(() {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        screenProtectorChannel,
        null,
      );
    });

    final state = _MutableBookingState(booking);
    final fakeDio = Dio()..httpClientAdapter = _SealsAdapter(state);

    await pumpApp(
      tester,
      const BookingDetailScreen(bookingId: 'b1'),
      overrides: [
        bookingRepositoryProvider.overrideWithValue(
          _FakeBookingRepository(state),
        ),
        dioProvider.overrideWithValue(fakeDio),
      ],
    );

    // Baslangicta esnaf henuz check-in yapmadi: muhur numarasi yok.
    expect(find.text('#A1'), findsNothing);

    // Esnaf dukkanda check-in yapip valize muhur takti: arka planda hem
    // durum CHECKED_IN oluyor hem de muhurler API'sinde artik veri var.
    state
      ..booking = state.booking.copyWith(status: BookingStatus.checkedIn)
      ..seals = [
        {'sealNumber': 'A1', 'bagSize': 'M', 'bagIndex': 0},
      ];

    // 10sn'lik polling zamanlayicisini tetikle.
    await tester.pump(const Duration(seconds: 10));
    await tester.pumpAndSettle();

    // Fix oncesi bookingSealsProvider hic invalidate edilmiyordu; muhur
    // numarasi bu noktada da bos kalirdi.
    expect(find.text('#A1'), findsOneWidget);
  });
}

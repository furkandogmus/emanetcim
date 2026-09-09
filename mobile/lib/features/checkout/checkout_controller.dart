import 'dart:async' show unawaited;

import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/services/haptic_service.dart';
import '../../core/utils/error_handler.dart';

enum CheckoutPayStatus { idle, submitting, success, error }

class CheckoutPayState {
  final CheckoutPayStatus status;
  final String? bookingId;
  final String? errorMessage;

  const CheckoutPayState({
    this.status = CheckoutPayStatus.idle,
    this.bookingId,
    this.errorMessage,
  });
}

final checkoutControllerProvider =
    NotifierProvider<CheckoutController, CheckoutPayState>(
      CheckoutController.new,
    );

/// Odeme akisi (MM-H3): eskiden `checkout_screen.dart`'ta `setState` +
/// `bool _busy` ile widget `State`'inde yonetiliyordu. Widget artik yalnizca
/// `pay(...)` cagirir ve state'i izler; basari/hata sonrasi navigasyon ve
/// haptik/review yan etkileri `ref.listen` ile widget tarafinda kalir
/// (boylece eskisi gibi yalnizca widget hala mounted iken tetiklenirler).
class CheckoutController extends Notifier<CheckoutPayState> {
  @override
  CheckoutPayState build() => const CheckoutPayState();

  Future<void> pay({
    required String shopId,
    required DateTime checkInTime,
    required DateTime checkOutTime,
    required int bagCountS,
    required int bagCountM,
    required int bagCountXl,
    required String couponCode,
    required double clientGrandTotal,
  }) async {
    unawaited(ref.read(hapticServiceProvider).medium());
    state = const CheckoutPayState(status: CheckoutPayStatus.submitting);
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post(
        '/checkout/intent',
        data: {
          'shopId': shopId,
          'checkInTime': checkInTime.toUtc().toIso8601String(),
          'checkOutTime': checkOutTime.toUtc().toIso8601String(),
          'bagCountS': bagCountS,
          'bagCountM': bagCountM,
          'bagCountXl': bagCountXl,
          'couponCode': couponCode,
        },
      );
      final bookingId = res.data['bookingId'] as String?;
      final serverTotal = res.data['totalPrice'] as num?;

      if (bookingId == null) {
        state = CheckoutPayState(
          status: CheckoutPayStatus.error,
          errorMessage: 'common.error'.tr(),
        );
        return;
      }

      // Sunucu fiyati ile tutarsizlik uyarisi -- yalnizca log, gosterim
      // sunucu fiyatini zaten esas alacak (rezervasyon detayi sunucudan
      // okunur).
      if (serverTotal != null && clientGrandTotal > 0) {
        final server = serverTotal.toDouble();
        final diff = (clientGrandTotal - server).abs();
        if (diff > 1) {
          debugPrint(
            '⚠️ Price mismatch: client=$clientGrandTotal server=$server',
          );
        }
      }

      state = CheckoutPayState(
        status: CheckoutPayStatus.success,
        bookingId: bookingId,
      );
    } catch (e) {
      var msg = getErrorMessage(e, fallback: 'common.error'.tr());
      if (e is DioException) {
        final errCode = e.response?.data['error'];
        if (errCode == 'no_bags') msg = 'checkout.error_no_bags'.tr();
        if (errCode == 'shop_not_found') {
          msg = 'checkout.error_shop_closed'.tr();
        }
      }
      state = CheckoutPayState(
        status: CheckoutPayStatus.error,
        errorMessage: msg,
      );
    }
  }
}

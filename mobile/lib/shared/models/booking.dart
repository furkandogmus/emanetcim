import 'package:freezed_annotation/freezed_annotation.dart';

part 'booking.freezed.dart';
part 'booking.g.dart';

enum BookingStatus {
  WAITING_APPROVAL,
  APPROVED,
  PENDING,
  PAID,
  CHECKED_IN,
  CHECKED_OUT,
  CANCELLED,
}

enum PaymentStatus { SUCCESS, REFUNDED, FAILED }

@freezed
abstract class BookingDto with _$BookingDto {
  const factory BookingDto({
    required String id,
    required String shopId,
    required String shopName,
    required DateTime checkInTime,
    required DateTime checkOutTime,
    required int bagCountS,
    required int bagCountM,
    required int bagCountXl,
    required double totalPrice,
    required BookingStatus status,
    String? qrCodeToken,
    String? guestName,
    double? latitude,
    double? longitude,
    String? shopPhone,
  }) = _BookingDto;

  factory BookingDto.fromJson(Map<String, dynamic> json) => _$BookingDtoFromJson(json);
}

extension BookingDtoX on BookingDto {
  int get totalBags => bagCountS + bagCountM + bagCountXl;
}

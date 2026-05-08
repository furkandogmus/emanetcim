import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../../shared/models/booking.dart';

/// Shared booking status helpers to eliminate duplication
/// across my_bookings_screen.dart and partner_bookings_screen.dart.

Color bookingStatusColor(BookingStatus status) {
  switch (status) {
    case BookingStatus.paid:
    case BookingStatus.approved:
      return Colors.green;
    case BookingStatus.checkedIn:
      return Colors.blue;
    case BookingStatus.cancelled:
      return Colors.redAccent;
    case BookingStatus.checkedOut:
      return Colors.grey;
    case BookingStatus.waitingApproval:
    case BookingStatus.pending:
      return Colors.orange;
  }
}

String bookingStatusLabel(BookingStatus status) {
  const map = {
    BookingStatus.pending: 'waiting_approval',
    BookingStatus.waitingApproval: 'waiting_approval',
    BookingStatus.paid: 'paid',
    BookingStatus.approved: 'approved',
    BookingStatus.checkedIn: 'checked_in',
    BookingStatus.checkedOut: 'checked_out',
    BookingStatus.cancelled: 'cancelled',
  };
  return 'booking.status.${map[status] ?? 'waiting_approval'}'.tr();
}

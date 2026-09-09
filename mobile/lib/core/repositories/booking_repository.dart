import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

import '../../shared/models/booking.dart';
import '../api/api_client.dart';
import '../services/logger_service.dart';
import '../utils/result.dart';

/// Centralized booking data access — handles caching and error mapping.
final bookingRepositoryProvider = Provider<BookingRepository>((ref) {
  return BookingRepository(ref.watch(dioProvider));
});

class BookingRepository {
  final Dio _dio;
  final Box? _myBookingsBox;
  final Box? _partnerBookingsBox;

  BookingRepository(this._dio, {Box? myBookingsBox, Box? partnerBookingsBox})
    : _myBookingsBox = myBookingsBox,
      _partnerBookingsBox = partnerBookingsBox;

  Box get _myBox => _myBookingsBox ?? Hive.box('my_bookings_cache');
  Box get _partnerBox =>
      _partnerBookingsBox ?? Hive.box('partner_bookings_cache');

  Future<Result<List<BookingDto>>> getMyBookings() async {
    final box = _myBox;
    try {
      final res = await _dio.get('/bookings/me');
      final list = res.data as List;
      final bookings = list
          .map((e) => BookingDto.fromJson(e as Map<String, dynamic>))
          .toList();

      await box.put('list', list);
      return Success(bookings);
    } catch (e, stack) {
      Logger.w('Failed to fetch bookings, trying cache', e, stack);
      final cached = box.get('list');
      if (cached != null) {
        final bookings = (cached as List)
            .map((e) => BookingDto.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        return Success(bookings);
      }
      return Failure('Failed to fetch bookings and no cache available', e);
    }
  }

  Future<Result<List<BookingDto>>> getPartnerBookings() async {
    final box = _partnerBox;
    try {
      final res = await _dio.get('/partner/bookings');
      final data = res.data;
      final List<dynamic> list;
      if (data is Map<String, dynamic> && data.containsKey('items')) {
        list = data['items'] as List<dynamic>;
      } else {
        list = data as List<dynamic>;
      }
      final bookings = list
          .map((e) => BookingDto.fromJson(e as Map<String, dynamic>))
          .toList();

      await box.put('list', list);
      return Success(bookings);
    } catch (e, stack) {
      Logger.w('Failed to fetch partner bookings, trying cache', e, stack);
      final cached = box.get('list');
      if (cached != null) {
        final bookings = (cached as List<dynamic>)
            .map((e) => BookingDto.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        return Success(bookings);
      }
      return Failure('Failed to fetch partner bookings', e);
    }
  }

  Future<Result<BookingDto>> getById(String id) async {
    try {
      final res = await _dio.get('/bookings/$id');
      return Success(BookingDto.fromJson(res.data as Map<String, dynamic>));
    } on DioException catch (e) {
      return Failure(e.message ?? 'Network error', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }
}

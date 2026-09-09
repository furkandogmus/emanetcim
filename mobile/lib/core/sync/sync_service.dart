import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

import '../api/api_client.dart';
import '../auth/auth_controller.dart';

enum SyncActionType { checkIn, checkOut }

class SyncAction {
  final String id;
  final String userId;
  final SyncActionType type;
  final String bookingId;
  final Map<String, dynamic>? data;
  final DateTime timestamp;

  SyncAction({
    required this.id,
    required this.userId,
    required this.type,
    required this.bookingId,
    required this.timestamp,
    this.data,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'userId': userId,
    'type': type.index,
    'bookingId': bookingId,
    'data': data,
    'timestamp': timestamp.toIso8601String(),
  };

  factory SyncAction.fromJson(Map<String, dynamic> json) => SyncAction(
    id: json['id'] as String,
    userId: json['userId'] as String? ?? 'unknown',
    type: SyncActionType.values[json['type'] as int],
    bookingId: json['bookingId'] as String,
    data: json['data'] as Map<String, dynamic>?,
    timestamp: DateTime.parse(json['timestamp'] as String),
  );
}

final syncServiceProvider = Provider((ref) {
  final service = SyncService(ref)..init();
  ref.onDispose(service.dispose);
  return service;
});

class SyncService {
  final Ref _ref;
  static const String _boxName = 'pending_sync_actions';
  bool _isSyncing = false;
  StreamSubscription? _connectivitySub;

  SyncService(this._ref);

  void init() {
    // Auth bootstrap (SharedPreferences + secure token okuma + /auth/me)
    // acilista bir frame'den cok daha uzun surer, bu yuzden acilista TEK
    // SEFERLIK bir sync() cagrisi (onceden app.dart'ta) session hala null
    // iken calisir ve `sync()` sessizce no-op doner (bkz. asagidaki
    // guard). Bunun yerine oturum null'dan dolu bir degere GECTIGINDE
    // (bootstrap bitince veya login sonrasi) burada dinleyip tetikliyoruz;
    // boylece internet zaten acikken (baglanti DEGISMEDigi icin
    // onConnectivityChanged hic tetiklenmez) acilan uygulamada bekleyen
    // offline check-in/check-out kayitlari gercekten senkronize olur.
    _ref.listen(authControllerProvider, (previous, next) {
      if (next.session != null && previous?.session == null) {
        sync();
      }
    });

    // Listen for network changes to trigger sync
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      // results is a List<ConnectivityResult> in newer versions
      final hasConnection = results.any((r) => r != ConnectivityResult.none);
      if (hasConnection) {
        debugPrint('Network restored, triggering sync...');
        sync();
      }
    });
  }

  void dispose() {
    _connectivitySub?.cancel();
  }

  Box get _box => Hive.box(_boxName);

  List<SyncAction> get pendingActions {
    return _box.values
        .map((e) => SyncAction.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> addAction(
    SyncActionType type,
    String bookingId, [
    Map<String, dynamic>? data,
  ]) async {
    final userId = _ref.read(authControllerProvider).session?.id ?? 'guest';

    // Ayni booking+type icin zaten bekleyen bir aksiyon varsa yenisini
    // eklemiyoruz. Aksi halde esnaf senkronize olmadan ayni rezervasyona
    // tekrar girip ayni aksiyonu bir daha tetiklerse (liste/detay ekrani
    // hala eski -- onaylanmis -- durumu gosterdigi icin buton hala
    // aktiftir), baglanti geri geldiginde ayni booking icin iki check-in/
    // check-out istegi art arda backend'e gonderilir.
    final alreadyPending = pendingActions.any(
      (a) => a.userId == userId && a.bookingId == bookingId && a.type == type,
    );
    if (alreadyPending) {
      debugPrint(
        'Offline action skipped, already pending for booking '
        '$bookingId: $type',
      );
      return;
    }

    final action = SyncAction(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      userId: userId,
      type: type,
      bookingId: bookingId,
      data: data,
      timestamp: DateTime.now(),
    );
    await _box.put(action.id, action.toJson());
    debugPrint('Offline action added for user $userId: ${action.type}');
    unawaited(sync());
  }

  Future<void> sync() async {
    if (_isSyncing) return;

    final currentUser = _ref.read(authControllerProvider).session;
    if (currentUser == null) return;

    final allActions = pendingActions;
    final actions = allActions
        .where((a) => a.userId == currentUser.id)
        .toList();

    if (actions.isEmpty) return;

    _isSyncing = true;
    final dio = _ref.read(dioProvider);

    try {
      for (final action in actions) {
        try {
          if (action.type == SyncActionType.checkIn) {
            await dio.post(
              '/bookings/${action.bookingId}/check-in',
              data: action.data,
            );
          } else {
            await dio.post('/bookings/${action.bookingId}/check-out');
          }
          await _box.delete(action.id);
          debugPrint('Action ${action.id} synced successfully.');
        } catch (e) {
          // 4xx: sunucu isteği kalıcı olarak reddetti (ör. rezervasyon başka
          // cihazdan zaten check-in edilmiş). Yeniden denemek sonucu
          // değiştirmez, bu yüzden kuyruktan düşür ve kalan işlemlere devam
          // et — aksi halde bu tek kalıcı hata, arkasındaki tüm geçerli
          // işlemleri sonsuza dek bloklar (30sn'de bir tekrar denenir).
          if (e is DioException) {
            final statusCode = e.response?.statusCode;
            if (statusCode != null && statusCode >= 400 && statusCode < 500) {
              debugPrint(
                'Action ${action.id} permanently rejected (HTTP $statusCode), '
                'dropping from queue: $e',
              );
              await _box.delete(action.id);
              continue;
            }
          }
          // Geçici hata (ağ/timeout/5xx): kuyruğu olduğu gibi bırak, sonraki
          // bağlantı/30sn zamanlayıcısında yeniden denenecek.
          debugPrint('Sync failed for action ${action.id}: $e');
          break; // Stop on failure (likely still offline or API error)
        }
      }
    } finally {
      _isSyncing = false;
      if (_box.values.any((v) {
        final a = SyncAction.fromJson(v as Map<String, dynamic>);
        return a.userId == currentUser.id;
      })) {
        Future.delayed(const Duration(seconds: 30), () {
          if (_ref.read(authControllerProvider).session != null) {
            unawaited(sync());
          }
        });
      }
    }
  }
}

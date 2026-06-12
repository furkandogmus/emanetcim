import 'dart:io' show Platform;
import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../app/router.dart';
import '../api/api_client.dart';
import '../config/env.dart';
import 'notification_prefs.dart';

final pushServiceProvider = Provider<PushService>(PushService.new);

class PushService {
  PushService(this.ref);
  final Ref ref;

  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  bool _inited = false;

  Future<void> init() async {
    if (_inited || !Env.firebaseEnabled) return;
    _inited = true;

    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (details) {
        final payload = details.payload;
        if (payload == null) return;
        _handleNotificationData(_parsePayload(payload));
      },
    );

    final fm = FirebaseMessaging.instance;
    await fm.requestPermission();

    FirebaseMessaging.onMessage.listen(_onForeground);
    FirebaseMessaging.onMessageOpenedApp.listen(_onBackgroundTap);
    fm.onTokenRefresh.listen(_register);

    final token = await fm.getToken();
    if (token != null) await _register(token);
  }

  void _handleNotificationData(Map<String, dynamic> data) {
    final type = data['type'] as String?;
    final id = data['id'] as String?;
    if (type == null) return;

    final router = _getRouter();
    if (router == null) return;

    switch (type) {
      case 'booking':
        if (id != null) router.push('/booking/$id');
        break;
      case 'partner_booking':
        if (id != null) router.push('/partner/booking/$id');
        break;
    }
  }

  GoRouter? _getRouter() {
    try {
      return ref.read(routerProvider);
    } catch (_) {
      return null;
    }
  }

  Map<String, dynamic> _parsePayload(String? payload) {
    if (payload == null || payload.isEmpty) return {};
    try {
      final decoded = Uri.splitQueryString(payload);
      return decoded;
    } catch (_) {
      return {};
    }
  }

  Future<void> _onBackgroundTap(RemoteMessage msg) async {
    final data = msg.data;
    if (data.isNotEmpty) _handleNotificationData(data);
  }

  Future<void> _register(String token) async {
    try {
      final info = await PackageInfo.fromPlatform();
      await ref
          .read(dioProvider)
          .post('/push/register', data: {
            'token': token,
            'platform': Platform.isIOS ? 'ios' : 'android',
            'appVersion': '${info.version}+${info.buildNumber}',
          });
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return;
      // Retry on next token refresh
    }
  }

  Future<void> _onForeground(RemoteMessage msg) async {
    final n = msg.notification;
    if (n == null) return;

    final prefs = ref.read(notificationPrefsProvider);
    final type = msg.data['type'] as String?;

    if (type == 'partner_booking' && !prefs.partnerAlerts) return;
    if (type == 'booking' && !prefs.bookingUpdates) return;
    if ((type == null || type == 'promo') && !prefs.promotions) return;

    final data = msg.data.isNotEmpty ? msg.data.toString() : null;
    await _local.show(
      id: msg.messageId.hashCode,
      title: n.title,
      body: n.body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'booking_updates',
          'Rezervasyon',
          channelDescription: 'Rezervasyon güncellemeleri',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: data,
    );
  }
}
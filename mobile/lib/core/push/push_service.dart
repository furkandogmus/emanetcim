import 'dart:io' show Platform;
import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../api/api_client.dart';
import '../config/env.dart';

final pushServiceProvider = Provider<PushService>((ref) => PushService(ref));

class PushService {
  PushService(this.ref);
  final Ref ref;

  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();
  bool _inited = false;

  Future<void> init() async {
    if (_inited || !Env.firebaseEnabled) return;
    _inited = true;

    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );

    final fm = FirebaseMessaging.instance;
    await fm.requestPermission(alert: true, badge: true, sound: true);

    FirebaseMessaging.onMessage.listen(_onForeground);
    fm.onTokenRefresh.listen(_register);

    final token = await fm.getToken();
    if (token != null) await _register(token);
  }

  Future<void> _register(String token) async {
    try {
      final info = await PackageInfo.fromPlatform();
      await ref.read(dioProvider).post('/push/register', data: {
        'token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
        'appVersion': '${info.version}+${info.buildNumber}',
      });
    } on DioException {
      // Silently ignore — user may not be logged in yet
    }
  }

  Future<void> _onForeground(RemoteMessage msg) async {
    final n = msg.notification;
    if (n == null) return;
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
      payload: msg.data.toString(),
    );
  }
}

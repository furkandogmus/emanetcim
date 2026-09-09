import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/notification.dart';

class NotificationNotifier extends Notifier<List<NotificationDto>> {
  @override
  List<NotificationDto> build() => [];

  void markAllAsRead() {
    state = [for (final n in state) n.copyWith(isRead: true)];
  }

  void markAsRead(String id) {
    state = [
      for (final n in state)
        if (n.id == id) n.copyWith(isRead: true) else n,
    ];
  }

  void clearAll() {
    state = [];
  }

  void addNotification(NotificationDto notification) {
    state = [notification, ...state];
  }
}

final notificationProvider =
    NotifierProvider<NotificationNotifier, List<NotificationDto>>(
      NotificationNotifier.new,
    );

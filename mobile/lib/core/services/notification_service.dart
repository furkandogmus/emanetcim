import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/notification.dart';

class NotificationNotifier extends Notifier<List<NotificationDto>> {
  @override
  List<NotificationDto> build() => [];

  void markAllAsRead() {
    state = [for (final n in state) n.copyWith(isRead: true)];
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

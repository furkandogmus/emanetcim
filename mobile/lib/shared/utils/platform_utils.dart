import 'dart:io' show Platform;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

bool get isIOS => Platform.isIOS;
bool get isAndroid => Platform.isAndroid;

/// Platform-adaptive bottom sheet.
/// iOS: Cupertino-style popup with drag handle
/// Android: Material 3 bottom sheet
Future<T?> showAdaptiveBottomSheet<T>(
  BuildContext context, {
    required Widget child,
    bool isDismissible = true,
    bool useSafeArea = true,
    double? heightFactor,
  }) {
    if (isIOS) {
      return showCupertinoModalPopup<T>(
        context: context,
        barrierDismissible: isDismissible,
        semanticsDismissible: isDismissible,
        builder: (ctx) => Container(
          margin: EdgeInsets.only(
            top: MediaQuery.of(ctx).size.height * (1 - (heightFactor ?? 0.85)),
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 8, bottom: 4),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Expanded(child: child),
              ],
            ),
          ),
        ),
      );
    }
    return showModalBottomSheet<T>(
      context: context,
      isDismissible: isDismissible,
      isScrollControlled: heightFactor != null,
      useSafeArea: useSafeArea,
      backgroundColor: Colors.white,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => heightFactor != null
          ? SizedBox(
              height: MediaQuery.of(context).size.height * heightFactor,
              child: child,
            )
          : child,
    );
  }

/// Platform-adaptive action sheet.
/// iOS: [CupertinoActionSheet]
/// Android: Material modal bottom sheet with ListTile options
Future<T?> showAdaptiveActionSheet<T>(
  BuildContext context, {
    required String title,
    required List<AdaptiveAction<T>> actions,
    String? message,
    String? cancelLabel,
  }) {
    if (isIOS) {
      return showCupertinoModalPopup<T>(
        context: context,
        builder: (ctx) => CupertinoActionSheet(
          title: Text(title),
          message: message != null ? Text(message) : null,
          actions: actions.map((a) {
            return CupertinoActionSheetAction(
              isDefaultAction: a.isDefault,
              isDestructiveAction: a.isDestructive,
              onPressed: () => Navigator.of(ctx).pop(a.value),
              child: Text(a.label),
            );
          }).toList(),
          cancelButton: CupertinoActionSheetAction(
            isDefaultAction: true,
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(cancelLabel ?? 'Cancel'),
          ),
        ),
      );
    }
    return showModalBottomSheet<T>(
      context: context,
      backgroundColor: Colors.white,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                child: Text(
                  title,
                  style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ),
              if (message != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 4, 24, 12),
                  child: Text(
                    message,
                    style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey[600],
                        ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ...actions.map((a) => ListTile(
                    leading: a.icon != null ? Icon(a.icon) : null,
                    title: Text(
                      a.label,
                      style: TextStyle(
                        fontWeight: a.isDefault ? FontWeight.bold : FontWeight.normal,
                        color: a.isDestructive ? Colors.red : null,
                      ),
                    ),
                    onTap: () => Navigator.of(ctx).pop(a.value),
                  )),
            ],
          ),
        ),
      ),
    );
  }

class AdaptiveAction<T> {
  final String label;
  final T value;
  final IconData? icon;
  final bool isDefault;
  final bool isDestructive;

  const AdaptiveAction({
    required this.label,
    required this.value,
    this.icon,
    this.isDefault = false,
    this.isDestructive = false,
  });
}

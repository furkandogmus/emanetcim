import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

class PermissionsScreen extends StatefulWidget {
  const PermissionsScreen({super.key});

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionEntry {
  final String labelKey;
  final IconData icon;
  final Permission permission;
  const _PermissionEntry(this.labelKey, this.icon, this.permission);
}

const _entries = [
  _PermissionEntry(
    'security.permissions_camera',
    Icons.camera_alt_outlined,
    Permission.camera,
  ),
  _PermissionEntry(
    'security.permissions_location',
    Icons.location_on_outlined,
    Permission.locationWhenInUse,
  ),
  _PermissionEntry(
    'security.permissions_notifications',
    Icons.notifications_outlined,
    Permission.notification,
  ),
];

class _PermissionsScreenState extends State<PermissionsScreen>
    with WidgetsBindingObserver {
  Map<Permission, PermissionStatus> _statuses = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Kullanici sistem ayarlarindan donunce durumu tazele.
    if (state == AppLifecycleState.resumed) _load();
  }

  Future<void> _load() async {
    final statuses = <Permission, PermissionStatus>{};
    for (final e in _entries) {
      statuses[e.permission] = await e.permission.status;
    }
    if (mounted) setState(() => _statuses = statuses);
  }

  String _statusLabel(PermissionStatus status) {
    switch (status) {
      case PermissionStatus.granted:
      case PermissionStatus.limited:
      case PermissionStatus.provisional:
        return 'security.permissions_status_granted'.tr();
      case PermissionStatus.denied:
        return 'security.permissions_status_denied'.tr();
      case PermissionStatus.permanentlyDenied:
        return 'security.permissions_status_permanently_denied'.tr();
      case PermissionStatus.restricted:
        return 'security.permissions_status_restricted'.tr();
    }
  }

  Color _statusColor(PermissionStatus status) {
    if (status == PermissionStatus.granted ||
        status == PermissionStatus.limited ||
        status == PermissionStatus.provisional) {
      return Colors.green;
    }
    return Colors.redAccent;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'security.permissions_title'.tr(),
          style: Theme.of(
            context,
          ).textTheme.titleSmall!.copyWith(fontWeight: FontWeight.bold),
        ),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _entries.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final e = _entries[index];
          final status = _statuses[e.permission];
          return Card(
            child: ListTile(
              leading: Icon(e.icon),
              title: Text(e.labelKey.tr()),
              subtitle: status == null
                  ? null
                  : Text(
                      _statusLabel(status),
                      style: TextStyle(color: _statusColor(status)),
                    ),
              trailing: TextButton(
                onPressed: openAppSettings,
                child: Text('security.permissions_open_settings'.tr()),
              ),
            ),
          );
        },
      ),
    );
  }
}

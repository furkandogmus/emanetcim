import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/repositories/push_repository.dart';
import '../../shared/models/mobile_device.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/error_state.dart';

class DevicesScreen extends ConsumerStatefulWidget {
  const DevicesScreen({super.key});

  @override
  ConsumerState<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends ConsumerState<DevicesScreen> {
  List<MobileDeviceDto>? _devices;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(pushRepositoryProvider).getDevices();
    if (!mounted) return;
    setState(() {
      _loading = false;
      _devices = result.data;
      _error = result.error;
    });
  }

  Future<void> _confirmRemove(MobileDeviceDto device) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'security.devices_remove_confirm_title'.tr(),
          style: Theme.of(
            context,
          ).textTheme.titleSmall!.copyWith(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'security.devices_remove_confirm_desc'.tr(),
          style: Theme.of(context).textTheme.bodyMedium!,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('common.cancel'.tr()),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              'security.devices_remove'.tr(),
              style: const TextStyle(color: Colors.redAccent),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final result = await ref
        .read(pushRepositoryProvider)
        .removeDevice(device.token);
    if (!mounted) return;
    if (result.isSuccess) {
      setState(() => _devices?.remove(device));
    } else {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.error ?? '')));
    }
  }

  IconData _platformIcon(String platform) {
    return platform == 'ios'
        ? Icons.phone_iphone_rounded
        : Icons.android_rounded;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'security.devices_title'.tr(),
          style: Theme.of(
            context,
          ).textTheme.titleSmall!.copyWith(fontWeight: FontWeight.bold),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? ErrorState(title: _error!)
          : (_devices == null || _devices!.isEmpty)
          ? EmptyState(
              icon: Icons.devices_other_rounded,
              title: 'security.devices_empty'.tr(),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _devices!.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final d = _devices![index];
                  return Card(
                    child: ListTile(
                      leading: Icon(_platformIcon(d.platform)),
                      title: Text('•••• ${d.tokenSuffix}'),
                      subtitle: Text(
                        'security.devices_last_seen'.tr(
                          namedArgs: {
                            'date': DateFormat(
                              'dd MMM yyyy, HH:mm',
                            ).format(d.lastSeenAt.toLocal()),
                          },
                        ),
                      ),
                      trailing: IconButton(
                        tooltip: 'security.devices_remove'.tr(),
                        icon: const Icon(
                          Icons.delete_outline_rounded,
                          color: Colors.redAccent,
                        ),
                        onPressed: () => _confirmRemove(d),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}

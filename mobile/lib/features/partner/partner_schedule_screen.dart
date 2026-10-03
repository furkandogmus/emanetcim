import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/utils/error_handler.dart';
import '../../shared/widgets/error_state.dart';

class _Day {
  _Day(this.weekday, this.isClosed, this.opening, this.closing);
  final int weekday;
  bool isClosed;
  String opening;
  String closing;
}

class _Closure {
  _Closure(this.id, this.startDate, this.endDate, this.reason);
  final String id;
  final String startDate;
  final String endDate;
  final String? reason;
}

/// Esnaf: gun bazli acilis/kapanis, 7/24 ve izin gunleri.
/// Sunucu aktif rezervasyonu olan gune izni reddeder (409 `schedule_conflict`).
class PartnerScheduleScreen extends ConsumerStatefulWidget {
  const PartnerScheduleScreen({super.key});

  @override
  ConsumerState<PartnerScheduleScreen> createState() =>
      _PartnerScheduleScreenState();
}

class _PartnerScheduleScreenState extends ConsumerState<PartnerScheduleScreen> {
  bool _loading = true;
  bool _loadError = false;
  bool _busy = false;
  bool _open247 = false;
  List<_Day> _days = [];
  List<_Closure> _closures = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = false;
    });
    try {
      final res = await ref.read(dioProvider).get('/partner/shop/schedule');
      final data = res.data as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _open247 = data['open247'] == true;
        _days = [
          for (final d in data['days'] as List)
            _Day(
              d['weekday'] as int,
              d['isClosed'] == true,
              d['openingTime'] as String,
              d['closingTime'] as String,
            ),
        ];
        _closures = [
          for (final c in data['closures'] as List)
            _Closure(
              c['id'] as String,
              c['startDate'] as String,
              c['endDate'] as String,
              c['reason'] as String?,
            ),
        ];
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = true;
      });
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  /// 409 `schedule_conflict`: cakisan rezervasyonlari tek mesajda soyler.
  String _failure(Object e) {
    if (e is DioException && e.response?.statusCode == 409) {
      final conflicts = (e.response?.data['conflicts'] as List?) ?? const [];
      final lines = conflicts
          .take(5)
          .map((c) => '${c['date']} · ${c['guestName'] ?? '—'}')
          .join('\n');
      return '${'partner.schedule_conflict'.tr()}\n$lines';
    }
    return getErrorMessage(e, fallback: 'common.error'.tr());
  }

  Future<void> _run(Future<void> Function() action, {String? okMessage}) async {
    setState(() => _busy = true);
    try {
      await action();
      if (okMessage != null) _snack(okMessage);
      await _load();
    } catch (e) {
      _snack(_failure(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveHours() => _run(() async {
    await ref
        .read(dioProvider)
        .put(
          '/partner/shop/schedule',
          data: {
            'open247': _open247,
            'days': [
              for (final d in _days)
                {
                  'weekday': d.weekday,
                  'isClosed': d.isClosed,
                  'openingTime': d.opening,
                  'closingTime': d.closing,
                },
            ],
          },
        );
  }, okMessage: 'partner.schedule_saved'.tr());

  Future<void> _pickTime(_Day d, {required bool opening}) async {
    final current = (opening ? d.opening : d.closing).split(':');
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.parse(current[0]),
        minute: int.parse(current[1]),
      ),
    );
    if (picked == null) return;
    final v =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    setState(() => opening ? d.opening = v : d.closing = v);
  }

  String _iso(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _addClosure() async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (range == null) return;
    await _run(() async {
      await ref
          .read(dioProvider)
          .post(
            '/partner/shop/schedule',
            data: {'startDate': _iso(range.start), 'endDate': _iso(range.end)},
          );
    });
  }

  Future<void> _removeClosure(_Closure c) => _run(() async {
    await ref
        .read(dioProvider)
        .delete('/partner/shop/schedule', queryParameters: {'closureId': c.id});
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('partner.schedule_title'.tr())),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError
          ? ErrorState(
              title: 'common.error'.tr(),
              actionLabel: 'common.try_again'.tr(),
              onAction: _load,
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('partner.schedule_open247'.tr()),
                  subtitle: Text('partner.schedule_open247_hint'.tr()),
                  value: _open247,
                  onChanged: (v) => setState(() => _open247 = v),
                ),
                if (!_open247)
                  for (final d in _days)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 96,
                            child: Text('schedule.day_${d.weekday}'.tr()),
                          ),
                          Expanded(
                            child: d.isClosed
                                ? Text('schedule.closed'.tr())
                                : Row(
                                    children: [
                                      TextButton(
                                        onPressed: () =>
                                            _pickTime(d, opening: true),
                                        child: Text(d.opening),
                                      ),
                                      const Text('–'),
                                      TextButton(
                                        onPressed: () =>
                                            _pickTime(d, opening: false),
                                        child: Text(d.closing),
                                      ),
                                    ],
                                  ),
                          ),
                          Switch(
                            value: !d.isClosed,
                            onChanged: (open) =>
                                setState(() => d.isClosed = !open),
                          ),
                        ],
                      ),
                    ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _busy ? null : _saveHours,
                  child: Text('partner.schedule_save'.tr()),
                ),
                const Divider(height: 40),
                Text(
                  'partner.schedule_closures'.tr(),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text('partner.schedule_closures_hint'.tr()),
                const SizedBox(height: 8),
                if (_closures.isEmpty) Text('partner.schedule_none'.tr()),
                for (final c in _closures)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      c.startDate == c.endDate
                          ? c.startDate
                          : '${c.startDate} → ${c.endDate}',
                    ),
                    subtitle: c.reason == null ? null : Text(c.reason!),
                    trailing: IconButton(
                      tooltip: 'partner.schedule_remove'.tr(),
                      icon: const Icon(Icons.delete_outline_rounded),
                      onPressed: _busy ? null : () => _removeClosure(c),
                    ),
                  ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _addClosure,
                  icon: const Icon(Icons.event_busy_rounded),
                  label: Text('partner.schedule_add'.tr()),
                ),
              ],
            ),
    );
  }
}

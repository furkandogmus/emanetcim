import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';

class AdminApplicationsScreen extends ConsumerStatefulWidget {
  const AdminApplicationsScreen({super.key});

  @override
  ConsumerState<AdminApplicationsScreen> createState() =>
      _AdminApplicationsScreenState();
}

class _AdminApplicationsScreenState
    extends ConsumerState<AdminApplicationsScreen> {
  bool _loading = true;
  List<dynamic> _apps = [];

  @override
  void initState() {
    super.initState();
    _fetchApps();
  }

  Future<void> _fetchApps() async {
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get('/admin/applications');
      setState(() {
        _apps = res.data as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _apps = [
          {
            'id': '1',
            'name': 'Galata Souvenirs',
            'address': 'Bereketzade, Galata Kulesi Sk. No:12',
            'owner': {'name': 'Mehmet Yılmaz', 'phone': '0532 123 45 67'},
            'createdAt': DateTime.now()
                .subtract(const Duration(days: 2))
                .toIso8601String(),
          },
          {
            'id': '2',
            'name': 'Karaköy Coffee Hub',
            'address': 'Kemankeş Karamustafa Paşa, No:44',
            'owner': {'name': 'Ayşe Demir', 'phone': '0544 987 65 43'},
            'createdAt': DateTime.now()
                .subtract(const Duration(hours: 5))
                .toIso8601String(),
          },
        ];
        _loading = false;
      });
    }
  }

  Future<void> _process(String id, bool approve) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.post(
        '/admin/applications/$id/${approve ? 'approve' : 'reject'}',
      );
      _fetchApps();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Hata: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'admin.approve_shops'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
      ),
      body: _apps.isEmpty
          ? Center(
              child: Text(
                'Bekleyen başvuru bulunmuyor.',
                style: GoogleFonts.outfit(color: Colors.grey),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(20),
              itemCount: _apps.length,
              itemBuilder: (context, index) => _appCard(_apps[index]),
            ),
    );
  }

  Widget _appCard(dynamic app) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 10),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.store_rounded,
                  color: Color(0xFFF97316),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      app['name'],
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                    Text(
                      app['address'],
                      style: GoogleFonts.outfit(
                        color: Colors.grey,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _infoRow(Icons.person_outline_rounded, app['owner']['name']),
          const SizedBox(height: 8),
          _infoRow(Icons.phone_outlined, app['owner']['phone']),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Divider(),
          ),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _process(app['id'], false),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.redAccent,
                    side: const BorderSide(color: Colors.redAccent),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text('Reddet'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () => _process(app['id'], true),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text('Onayla'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey.shade400),
        const SizedBox(width: 8),
        Text(
          text,
          style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade600),
        ),
      ],
    );
  }
}

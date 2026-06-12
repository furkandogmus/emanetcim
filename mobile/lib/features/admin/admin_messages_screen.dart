import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api/api_client.dart';
import '../../core/utils/error_handler.dart';
import 'admin_controller.dart';

class AdminMessagesScreen extends ConsumerStatefulWidget {
  const AdminMessagesScreen({super.key});

  @override
  ConsumerState<AdminMessagesScreen> createState() =>
      _AdminMessagesScreenState();
}

class _AdminMessagesScreenState extends ConsumerState<AdminMessagesScreen> {
  List<dynamic> _messages = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchMessages();
  }

  Future<void> _fetchMessages() async {
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get('/admin/messages');
      setState(() {
        _messages = res.data as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(getErrorMessage(e, fallback: 'admin.messages_load_error'.tr())),
          ),
        );
      }
      setState(() => _loading = false);
    }
  }

  Future<void> _markAsRead(String id) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.patch('/admin/messages/$id');
      await _fetchMessages(); // Refresh list
      ref.invalidate(adminStatsProvider); // Refresh stats on dashboard
    } catch (e) {
      debugPrint('Error marking as read: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'admin.messages_title'.tr(),
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            onPressed: _fetchMessages,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _messages.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.message_rounded,
                    size: 48,
                    color: Color(0xFF616161),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'admin.no_messages'.tr(),
                    style: GoogleFonts.outfit(
                      color: const Color(0xFF616161),
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                final isRead = msg['isRead'] as bool? ?? false;
                final date = DateTime.parse(msg['createdAt'] as String);
                final formattedDate = DateFormat(
                  'dd.MM.yyyy HH:mm',
                ).format(date);

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(16),
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: isRead
                            ? Colors.grey.withValues(alpha: 0.1)
                            : Colors.blue.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.email_rounded,
                        color: isRead ? Colors.grey : Colors.blue,
                      ),
                    ),
                    title: Text(
                      msg['subject'] ?? 'Konu Yok',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: isRead ? Colors.grey : const Color(0xFF0F172A),
                      ),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 4),
                        Text(
                          'Kimden: ${msg['from'] ?? 'Bilinmiyor'}',
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            color: const Color(0xFF424242),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          formattedDate,
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            color: const Color(0xFF757575),
                          ),
                        ),
                      ],
                    ),
                    trailing: !isRead
                        ? Container(
                            width: 10,
                            height: 10,
                            decoration: const BoxDecoration(
                              color: Colors.blue,
                              shape: BoxShape.circle,
                            ),
                          )
                        : null,
                    onTap: () {
                      _showDetail(msg);
                      if (!isRead) {
                        _markAsRead(msg['id'] as String);
                      }
                    },
                  ),
                );
              },
            ),
    );
  }

  void _showDetail(dynamic msg) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        expand: false,
        builder: (_, scroll) => Padding(
          padding: const EdgeInsets.all(24),
          child: ListView(
            controller: scroll,
            children: [
              Text(
                msg['subject'] ?? 'Konu Yok',
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Kimden: ${msg['from'] ?? 'Bilinmiyor'}',
                style: GoogleFonts.outfit(color: const Color(0xFF424242)),
              ),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 16),
              Text(
                msg['text'] ?? msg['html'] ?? 'İçerik yok',
                style: GoogleFonts.outfit(height: 1.6),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

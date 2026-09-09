import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/repositories/admin_repository.dart';
import '../../shared/models/admin_stats.dart';

final adminStatsProvider = FutureProvider<AdminStatsDto>((ref) async {
  final result = await ref.watch(adminRepositoryProvider).getStats();
  return result.fold((data) => data, (error) => throw Exception(error));
});

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/providers.dart';
import '../../../core/network/api_client.dart';
import '../domain/part.dart';

/// Searches the catalogue via `GET /api/parts/search`. The backend proxies
/// Arrow (or serves a bundled sample when `arrow.mock=true`); either way the
/// response nests the hits under `partserviceresult.parts`.
class PartRepository {
  PartRepository(this._api);

  final ApiClient _api;

  Future<List<Part>> search(String query, {String? supplier}) async {
    if (query.trim().isEmpty) return [];
    final res = await _api.getJson<Map<String, dynamic>>(
      '/parts/search',
      query: {
        'q': query,
        if (supplier != null && supplier.isNotEmpty) 'supplier': supplier,
      },
    );
    final result = res.data?['partserviceresult'];
    final parts = (result is Map) ? result['parts'] : null;
    if (parts is! List) return [];
    return parts
        .whereType<Map>()
        .map((p) => Part.fromArrow(Map<String, dynamic>.from(p)))
        .toList();
  }
}

final partRepositoryProvider = Provider<PartRepository>((ref) {
  return PartRepository(ref.watch(apiClientProvider));
});

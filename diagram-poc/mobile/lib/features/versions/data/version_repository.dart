import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/providers.dart';
import '../../../core/network/api_client.dart';
import '../domain/version.dart';

/// Diagram version history (`/api/diagrams/{id}/versions`).
class VersionRepository {
  VersionRepository(this._api);

  final ApiClient _api;

  Future<List<VersionSummary>> list(int diagramId) async {
    final res = await _api.getJson<List<dynamic>>('/diagrams/$diagramId/versions');
    return (res.data ?? const [])
        .whereType<Map>()
        .map((e) => VersionSummary.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<VersionSummary> snapshot(
    int diagramId,
    String label,
    String contentJson,
  ) async {
    final res = await _api.postJson<Map<String, dynamic>>(
      '/diagrams/$diagramId/versions',
      body: {'label': label, 'contentJson': contentJson},
    );
    return VersionSummary.fromJson(res.data ?? const {});
  }

  Future<VersionDetail> get(int versionId) async {
    final res = await _api.getJson<Map<String, dynamic>>('/versions/$versionId');
    return VersionDetail.fromJson(res.data ?? const {});
  }
}

final versionRepositoryProvider = Provider<VersionRepository>((ref) {
  return VersionRepository(ref.watch(apiClientProvider));
});

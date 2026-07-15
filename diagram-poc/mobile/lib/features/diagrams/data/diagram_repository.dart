import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/providers.dart';
import '../../../core/network/api_client.dart';
import '../domain/diagram_detail.dart';
import '../domain/diagram_summary.dart';

/// CRUD against `/api/diagrams`.
class DiagramRepository {
  DiagramRepository(this._api);

  final ApiClient _api;

  Future<List<DiagramSummary>> list() async {
    final res = await _api.getJson<List<dynamic>>('/diagrams');
    final data = res.data ?? const [];
    return data
        .whereType<Map>()
        .map((e) => DiagramSummary.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<DiagramDetail> get(int id) async {
    final res = await _api.getJson<Map<String, dynamic>>('/diagrams/$id');
    return DiagramDetail.fromJson(res.data ?? const {});
  }

  Future<DiagramDetail> create({
    required String name,
    String contentJson = '',
    String classification = 'INTERNAL',
  }) async {
    final res = await _api.postJson<Map<String, dynamic>>(
      '/diagrams',
      body: {
        'name': name,
        'contentJson': contentJson,
        'classification': classification,
      },
    );
    return DiagramDetail.fromJson(res.data ?? const {});
  }

  Future<DiagramDetail> update({
    required int id,
    required String name,
    required String contentJson,
    required String classification,
  }) async {
    final res = await _api.putJson<Map<String, dynamic>>(
      '/diagrams/$id',
      body: {
        'name': name,
        'contentJson': contentJson,
        'classification': classification,
      },
    );
    return DiagramDetail.fromJson(res.data ?? const {});
  }

  Future<void> delete(int id) => _api.deleteJson<void>('/diagrams/$id');
}

final diagramRepositoryProvider = Provider<DiagramRepository>((ref) {
  return DiagramRepository(ref.watch(apiClientProvider));
});

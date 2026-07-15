import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/providers.dart';
import '../../../core/network/api_client.dart';
import '../domain/designwin_models.dart';

/// Navigates the Arrow Design-Win hierarchy via `/api/designwin/*`
/// (customers → projects → boards → customer parts). The backend serves live
/// Arrow data, or a bundled sample when `arrow.mock=true`.
class DesignWinRepository {
  DesignWinRepository(this._api);

  final ApiClient _api;

  Future<List<DwCustomer>> customers({String? customerName}) async {
    final data = await _get('customers', {'customerName': customerName});
    return _list(data, 'customerServiceResult', 'customers')
        .map(DwCustomer.fromJson)
        .toList();
  }

  Future<List<DwProject>> projects(String customerName) async {
    final data = await _get('projects', {'customerName': customerName});
    return _list(data, 'projectServiceResult', 'projects')
        .map(DwProject.fromJson)
        .toList();
  }

  Future<List<DwBoard>> boards(String projectId) async {
    final data = await _get('boards', {'projectId': projectId});
    return _list(data, 'boardServiceResult', 'boards')
        .map(DwBoard.fromJson)
        .toList();
  }

  Future<List<DwCustPart>> custParts({
    required String projectId,
    String? boardNum,
  }) async {
    final data = await _get('cust-parts', {
      'projectId': projectId,
      'boardNum': boardNum,
    });
    return _list(data, 'custPartServiceResult', 'parts')
        .map(DwCustPart.fromJson)
        .toList();
  }

  Future<Map<String, dynamic>> _get(
    String path,
    Map<String, String?> query,
  ) async {
    final res = await _api.getJson<Map<String, dynamic>>(
      '/designwin/$path',
      query: {
        for (final e in query.entries)
          if (e.value != null && e.value!.isNotEmpty) e.key: e.value!,
      },
    );
    return res.data ?? const {};
  }

  /// Pull `root.result.key[]` out of the Arrow-shaped envelope.
  List<Map<String, dynamic>> _list(
    Map<String, dynamic> data,
    String resultKey,
    String listKey,
  ) {
    final result = data[resultKey];
    final list = (result is Map) ? result[listKey] : null;
    if (list is! List) return const [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}

final designWinRepositoryProvider = Provider<DesignWinRepository>((ref) {
  return DesignWinRepository(ref.watch(apiClientProvider));
});

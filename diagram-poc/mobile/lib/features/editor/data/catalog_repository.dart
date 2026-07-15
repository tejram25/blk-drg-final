import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/providers.dart';
import '../../../core/network/api_client.dart';
import '../domain/block_type.dart';
import '../domain/electrical_symbols.g.dart';

/// The block/shape/symbol palette. Functional blocks and basic shapes come from
/// `GET /api/block-types`; the electrical symbols are known client-side (their
/// vector art ships with the app), so they are appended locally.
class CatalogRepository {
  CatalogRepository(this._api);

  final ApiClient _api;

  Future<List<BlockType>> blockTypes() async {
    final res = await _api.getJson<List<dynamic>>('/block-types');
    final data = res.data ?? const [];
    final fromServer = data
        .whereType<Map>()
        .map((e) => BlockType.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return [...fromServer, ..._electricalSymbols()];
  }

  List<BlockType> _electricalSymbols() {
    return kElectricalSymbols.keys.map((shape) {
      final meta = kElectricalMeta[shape];
      final label = _label(shape, meta?.value ?? '');
      return BlockType(
        key: shape,
        label: label,
        category: 'Electrical',
        colorHex: '#e2e8f0',
        shape: shape,
      );
    }).toList();
  }

  String _label(String shape, String value) {
    final base = shape.replaceFirst('elec-', '');
    final pretty = base.isEmpty ? shape : base[0].toUpperCase() + base.substring(1);
    return value.isEmpty ? pretty : '$pretty ($value)';
  }
}

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return CatalogRepository(ref.watch(apiClientProvider));
});

/// The palette, loaded once and cached.
final blockTypesProvider = FutureProvider<List<BlockType>>((ref) {
  return ref.watch(catalogRepositoryProvider).blockTypes();
});

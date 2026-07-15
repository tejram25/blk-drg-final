import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/diagram_repository.dart';
import '../domain/diagram_summary.dart';

/// Loads and mutates the list of diagrams.
class DiagramListController extends AsyncNotifier<List<DiagramSummary>> {
  DiagramRepository get _repo => ref.read(diagramRepositoryProvider);

  @override
  Future<List<DiagramSummary>> build() => _repo.list();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_repo.list);
  }

  Future<int?> createBlank(String name) async {
    final created = await _repo.create(name: name);
    await refresh();
    return created.id;
  }

  Future<void> delete(int id) async {
    // Optimistically drop it, then reconcile.
    final current = state.value ?? const [];
    state = AsyncData(current.where((d) => d.id != id).toList());
    await _repo.delete(id);
    await refresh();
  }
}

final diagramListControllerProvider =
    AsyncNotifierProvider<DiagramListController, List<DiagramSummary>>(
  DiagramListController.new,
);

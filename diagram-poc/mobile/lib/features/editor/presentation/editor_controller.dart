import 'dart:convert';
import 'dart:ui';

import 'package:flutter/foundation.dart';

import '../../diagrams/data/diagram_repository.dart';
import '../../diagrams/domain/diagram_detail.dart';
import '../domain/diagram_graph.dart';

/// Immutable snapshot of an open diagram's editable state.
class EditorState {
  EditorState({
    required this.detail,
    required this.graph,
    this.dirty = false,
    this.saving = false,
  });

  final DiagramDetail detail;
  final DiagramGraph graph;
  final bool dirty;
  final bool saving;

  EditorState copyWith({
    DiagramDetail? detail,
    DiagramGraph? graph,
    bool? dirty,
    bool? saving,
  }) {
    return EditorState(
      detail: detail ?? this.detail,
      graph: graph ?? this.graph,
      dirty: dirty ?? this.dirty,
      saving: saving ?? this.saving,
    );
  }
}

/// Screen-scoped controller for one open diagram. Loads it from the BFF, exposes
/// edit operations, and writes changes back. Kept as a plain [ChangeNotifier] so
/// it is independent of any state-management package version.
///
/// Positions edited on the canvas are serialized back into the GoJS model shape
/// (`loc: "x y"`), preserving every other field the web editor uses.
class EditorSession extends ChangeNotifier {
  EditorSession(this._repo, this.diagramId);

  final DiagramRepository _repo;
  final int diagramId;

  bool loading = true;
  Object? error;
  EditorState? state;

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final detail = await _repo.get(diagramId);
      state = EditorState(
        detail: detail,
        graph: DiagramGraph.parse(detail.contentJson),
      );
    } catch (e) {
      error = e;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  void moveNode(String key, Offset newPosition) {
    final s = state;
    if (s == null) return;
    final node = s.graph.nodesByKey[key];
    if (node == null) return;
    node.position = newPosition;
    node.raw['loc'] = '${newPosition.dx} ${newPosition.dy}';
    state = s.copyWith(dirty: true);
    notifyListeners();
  }

  Future<void> save() async {
    final s = state;
    if (s == null || s.saving) return;
    state = s.copyWith(saving: true);
    notifyListeners();
    try {
      final content = _serialize(s.graph);
      final updated = await _repo.update(
        id: s.detail.id,
        name: s.detail.name,
        contentJson: content,
        classification: s.detail.classification,
      );
      state = s.copyWith(detail: updated, dirty: false, saving: false);
    } catch (e) {
      error = e;
      state = s.copyWith(saving: false);
    } finally {
      notifyListeners();
    }
  }

  /// Rebuild a GoJS GraphLinksModel JSON from the (possibly edited) graph.
  String _serialize(DiagramGraph graph) {
    return jsonEncode({
      'class': 'GraphLinksModel',
      'linkFromPortIdProperty': 'fromPort',
      'linkToPortIdProperty': 'toPort',
      'nodeDataArray': graph.nodes.map((n) => n.raw).toList(),
      'linkDataArray': graph.links.map((l) => l.raw).toList(),
    });
  }
}

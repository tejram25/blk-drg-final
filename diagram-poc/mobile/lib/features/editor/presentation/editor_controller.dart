import 'dart:convert';
import 'dart:ui';

import 'package:flutter/foundation.dart';

import '../../diagrams/data/diagram_repository.dart';
import '../../diagrams/domain/diagram_detail.dart';
import '../../parts/domain/part.dart';
import '../domain/block_type.dart';
import '../domain/diagram_graph.dart';
import '../domain/electrical_symbols.g.dart';

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

  /// Add a palette entry at [position] (diagram-space top-left). Returns the new
  /// node's key so the caller can select it.
  String? addBlock(BlockType block, Offset position) {
    final s = state;
    if (s == null) return null;
    final key = _newKey(s.graph);
    final loc = '${position.dx} ${position.dy}';

    Map<String, dynamic> raw;
    if (block.isSymbol) {
      final def = kElectricalSymbols[block.shape];
      final meta = kElectricalMeta[block.shape];
      final ref = meta?.ref ?? '';
      raw = {
        'key': key,
        'category': 'symbol',
        'shape': block.shape,
        'text': ref.isEmpty ? '' : _nextRefdes(s.graph, ref),
        'size': def == null ? '100 40' : '${def.width} ${def.height}',
        'loc': loc,
      };
    } else if (block.isShape) {
      raw = {
        'key': key,
        'category': 'shape',
        'shape': block.shape,
        'text': block.label,
        'color': '#ffffff',
        'size': '140 90',
        'loc': loc,
      };
    } else {
      raw = {
        'key': key,
        'category': 'block',
        'text': block.label,
        'subtitle': block.category,
        'color': block.colorHex,
        'icon': block.icon ?? 'widgets',
        'size': '150 64',
        'loc': loc,
      };
    }

    s.graph.nodes.add(DiagramNode.fromJson(raw));
    state = s.copyWith(dirty: true);
    notifyListeners();
    return key;
  }

  /// Connect two nodes. A link between two electrical symbols is a schematic
  /// wire; otherwise it is a block connector.
  void addLink(String fromKey, String toKey) {
    final s = state;
    if (s == null || fromKey == toKey) return;
    final from = s.graph.nodesByKey[fromKey];
    final to = s.graph.nodesByKey[toKey];
    if (from == null || to == null) return;
    final wire = from.category == 'symbol' && to.category == 'symbol';
    final raw = {
      'category': 'link',
      'from': fromKey,
      'to': toKey,
      'fromPort': '',
      'toPort': '',
      if (wire) 'wire': true,
    };
    s.graph.links.add(DiagramLink.fromJson(raw));
    state = s.copyWith(dirty: true);
    notifyListeners();
  }

  /// Attach a catalogue part to a node, stored under `attachedParts` in the
  /// same `{ part, quantity }` shape the web editor uses (so it round-trips).
  void attachPart(String key, Part part, {int quantity = 1}) {
    final s = state;
    if (s == null) return;
    final node = s.graph.nodesByKey[key];
    if (node == null) return;
    final existing = node.raw['attachedParts'];
    final list = (existing is List)
        ? List<dynamic>.from(existing)
        : <dynamic>[];
    list.add({'part': part.toJson(), 'quantity': quantity});
    node.raw['attachedParts'] = list;
    state = s.copyWith(dirty: true);
    notifyListeners();
  }

  /// Delete a node and every link touching it.
  void deleteNode(String key) {
    final s = state;
    if (s == null) return;
    s.graph.nodes.removeWhere((n) => n.key == key);
    s.graph.links.removeWhere((l) => l.from == key || l.to == key);
    state = s.copyWith(dirty: true);
    notifyListeners();
  }

  String _newKey(DiagramGraph graph) {
    var max = 0;
    for (final n in graph.nodes) {
      final k = int.tryParse(n.key);
      if (k != null && k > max) max = k;
    }
    return '${max + 1}';
  }

  /// Next reference designator for a prefix (R1, R2, … / U1, U2, …).
  String _nextRefdes(DiagramGraph graph, String prefix) {
    var max = 0;
    final re = RegExp('^$prefix(\\d+)\$');
    for (final n in graph.nodes) {
      final m = re.firstMatch(n.text);
      if (m != null) {
        final v = int.tryParse(m.group(1)!) ?? 0;
        if (v > max) max = v;
      }
    }
    return '$prefix${max + 1}';
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

  /// The current diagram as a `{nodes, links}` model of plain maps — the shape
  /// the collaboration engine's `cells` map uses.
  Map<String, dynamic>? currentModel() {
    final g = state?.graph;
    if (g == null) return null;
    return {
      'nodes': g.nodes.map((n) => n.raw).toList(),
      'links': g.links.map((l) => l.raw).toList(),
    };
  }

  /// Replace the diagram from a remote `{nodes, links}` model (a collaboration
  /// update). Does not mark dirty — it reflects the shared document.
  void applyRemoteModel(Map<String, dynamic> model) {
    final s = state;
    if (s == null) return;
    final nodes = (model['nodes'] as List? ?? const [])
        .whereType<Map>()
        .map((m) => Map<String, dynamic>.from(m))
        .toList();
    final links = (model['links'] as List? ?? const [])
        .whereType<Map>()
        .map((m) => Map<String, dynamic>.from(m))
        .toList();
    final content = jsonEncode({
      'class': 'GraphLinksModel',
      'nodeDataArray': nodes,
      'linkDataArray': links,
    });
    state = s.copyWith(graph: DiagramGraph.parse(content));
    notifyListeners();
  }

  /// The current diagram serialized to a GoJS model JSON (for a version
  /// snapshot).
  String? currentContentJson() {
    final g = state?.graph;
    return g == null ? null : _serialize(g);
  }

  /// Replace the diagram content (e.g. restoring a version). Marks dirty so the
  /// user can save the restored content.
  void loadContent(String contentJson) {
    final s = state;
    if (s == null) return;
    state = s.copyWith(graph: DiagramGraph.parse(contentJson), dirty: true);
    notifyListeners();
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

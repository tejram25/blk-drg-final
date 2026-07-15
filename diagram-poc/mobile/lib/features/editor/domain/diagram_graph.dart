import 'dart:convert';
import 'dart:ui';

/// A node parsed from a GoJS node-data entry.
///
/// GoJS serializes position as a `"x y"` string (`loc`) and size as `"w h"`
/// (`size`). We keep the original data map so edits can be written back without
/// losing fields the mobile client doesn't model yet.
class DiagramNode {
  DiagramNode({
    required this.key,
    required this.category,
    required this.text,
    required this.position,
    required this.size,
    required this.color,
    required this.shape,
    required this.raw,
  });

  final String key;
  final String category;
  final String text;
  Offset position;
  final Size size;
  final Color? color;
  final String? shape;
  final Map<String, dynamic> raw;

  Rect get bounds => position & size;

  static const Size _defaultSize = Size(120, 60);

  factory DiagramNode.fromJson(Map<String, dynamic> json) {
    return DiagramNode(
      key: '${json['key']}',
      category: (json['category'] ?? '') as String,
      text: (json['text'] ?? '') as String,
      position: _parsePoint(json['loc']) ?? Offset.zero,
      size: _parseSize(json['size']) ?? _defaultSize,
      color: _parseColor(json['color'] ?? json['fill']),
      shape: json['shape'] as String?,
      raw: json,
    );
  }

  static Offset? _parsePoint(Object? v) {
    if (v is! String) return null;
    final parts = v.trim().split(RegExp(r'\s+'));
    if (parts.length < 2) return null;
    final x = double.tryParse(parts[0]);
    final y = double.tryParse(parts[1]);
    if (x == null || y == null) return null;
    return Offset(x, y);
  }

  static Size? _parseSize(Object? v) {
    if (v is! String) return null;
    final parts = v.trim().split(RegExp(r'\s+'));
    if (parts.length < 2) return null;
    final w = double.tryParse(parts[0]);
    final h = double.tryParse(parts[1]);
    if (w == null || h == null || w.isNaN || h.isNaN) return null;
    return Size(w, h);
  }
}

/// A link parsed from a GoJS link-data entry.
class DiagramLink {
  DiagramLink({
    required this.from,
    required this.to,
    required this.isWire,
    required this.points,
    required this.raw,
  });

  final String from;
  final String to;

  /// Schematic wire (pin-to-pin) vs. a block-to-block connector.
  final bool isWire;

  /// Optional explicit route saved by the editor (list of "x y" points).
  final List<Offset> points;
  final Map<String, dynamic> raw;

  factory DiagramLink.fromJson(Map<String, dynamic> json) {
    final rawPoints = json['points'];
    final pts = <Offset>[];
    if (rawPoints is List) {
      for (var i = 0; i + 1 < rawPoints.length; i += 2) {
        final x = (rawPoints[i] as num?)?.toDouble();
        final y = (rawPoints[i + 1] as num?)?.toDouble();
        if (x != null && y != null) pts.add(Offset(x, y));
      }
    }
    return DiagramLink(
      from: '${json['from']}',
      to: '${json['to']}',
      isWire: json['wire'] == true || json['category'] == 'wire',
      points: pts,
      raw: json,
    );
  }
}

/// The whole parsed diagram: nodes keyed for fast link lookup, plus links.
class DiagramGraph {
  DiagramGraph({required this.nodes, required this.links});

  final List<DiagramNode> nodes;
  final List<DiagramLink> links;

  Map<String, DiagramNode> get nodesByKey =>
      {for (final n in nodes) n.key: n};

  bool get isEmpty => nodes.isEmpty && links.isEmpty;

  /// Parse a GoJS GraphLinksModel JSON string. Returns an empty graph on any
  /// malformed input rather than throwing, so a bad diagram can't crash the UI.
  factory DiagramGraph.parse(String contentJson) {
    if (contentJson.trim().isEmpty) {
      return DiagramGraph(nodes: [], links: []);
    }
    try {
      final decoded = jsonDecode(contentJson);
      if (decoded is! Map) return DiagramGraph(nodes: [], links: []);
      final nodeArr = decoded['nodeDataArray'];
      final linkArr = decoded['linkDataArray'];
      final nodes = <DiagramNode>[];
      final links = <DiagramLink>[];
      if (nodeArr is List) {
        for (final n in nodeArr) {
          if (n is Map) {
            nodes.add(DiagramNode.fromJson(Map<String, dynamic>.from(n)));
          }
        }
      }
      if (linkArr is List) {
        for (final l in linkArr) {
          if (l is Map) {
            links.add(DiagramLink.fromJson(Map<String, dynamic>.from(l)));
          }
        }
      }
      return DiagramGraph(nodes: nodes, links: links);
    } catch (_) {
      return DiagramGraph(nodes: [], links: []);
    }
  }

  /// The bounding box of all node geometry (for fit-to-content).
  Rect contentBounds() {
    if (nodes.isEmpty) return const Rect.fromLTWH(0, 0, 800, 600);
    var rect = nodes.first.bounds;
    for (final n in nodes.skip(1)) {
      rect = rect.expandToInclude(n.bounds);
    }
    return rect;
  }
}

Color? _parseColor(Object? v) {
  if (v is! String || v.isEmpty) return null;
  var hex = v.trim();
  if (!hex.startsWith('#')) return null;
  hex = hex.substring(1);
  if (hex.length == 3) {
    hex = hex.split('').map((c) => '$c$c').join();
  }
  if (hex.length == 6) hex = 'FF$hex';
  final value = int.tryParse(hex, radix: 16);
  return value == null ? null : Color(value);
}

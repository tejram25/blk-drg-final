import 'package:flutter/material.dart';

import '../domain/diagram_graph.dart';
import 'symbol_painter.dart';

/// Interactive canvas that renders a [DiagramGraph]: pan, pinch-zoom, tap to
/// select, and one-finger drag to move a node. This is the mobile counterpart
/// to the GoJS canvas on web — a hand-rolled renderer so we don't depend on a
/// web-only diagramming library.
class DiagramCanvas extends StatefulWidget {
  const DiagramCanvas({
    super.key,
    required this.graph,
    required this.selectedKey,
    required this.onSelect,
    required this.onNodeMoved,
  });

  final DiagramGraph graph;
  final String? selectedKey;
  final ValueChanged<String?> onSelect;

  /// Called continuously while dragging a node (diagram-space top-left).
  final void Function(String key, Offset position) onNodeMoved;

  @override
  State<DiagramCanvas> createState() => _DiagramCanvasState();
}

class _DiagramCanvasState extends State<DiagramCanvas> {
  double _scale = 1;
  Offset _offset = Offset.zero;
  bool _initialized = false;

  // Gesture bookkeeping.
  double _startScale = 1;
  Offset _focalDiagram = Offset.zero;
  String? _draggingKey;
  Offset _grabOffset = Offset.zero;

  static const double _minScale = 0.2;
  static const double _maxScale = 5.0;

  void _fit(Size viewport) {
    final bounds = widget.graph.contentBounds().inflate(40);
    if (bounds.width <= 0 || bounds.height <= 0) return;
    final scale = (viewport.width / bounds.width)
        .clamp(_minScale, _maxScale)
        .toDouble();
    final s = scale
        .clamp(_minScale, (viewport.height / bounds.height))
        .toDouble()
        .clamp(_minScale, _maxScale)
        .toDouble();
    _scale = s;
    _offset = Offset(
      (viewport.width - bounds.width * s) / 2 - bounds.left * s,
      (viewport.height - bounds.height * s) / 2 - bounds.top * s,
    );
  }

  Offset _toDiagram(Offset local) => (local - _offset) / _scale;

  String? _hitTest(Offset diagramPoint) {
    for (final node in widget.graph.nodes.reversed) {
      if (node.bounds.contains(diagramPoint)) return node.key;
    }
    return null;
  }

  void _onScaleStart(ScaleStartDetails d) {
    _startScale = _scale;
    _focalDiagram = _toDiagram(d.localFocalPoint);
    if (d.pointerCount == 1) {
      final key = _hitTest(_focalDiagram);
      _draggingKey = key;
      if (key != null) {
        final node = widget.graph.nodesByKey[key]!;
        _grabOffset = _focalDiagram - node.position;
        widget.onSelect(key);
      }
    } else {
      _draggingKey = null;
    }
  }

  void _onScaleUpdate(ScaleUpdateDetails d) {
    if (_draggingKey != null && d.pointerCount == 1 && d.scale == 1.0) {
      final diagramPoint = _toDiagram(d.localFocalPoint);
      widget.onNodeMoved(_draggingKey!, diagramPoint - _grabOffset);
      return;
    }
    setState(() {
      _scale = (_startScale * d.scale).clamp(_minScale, _maxScale).toDouble();
      _offset = d.localFocalPoint - _focalDiagram * _scale;
    });
  }

  void _onTapUp(TapUpDetails d) {
    widget.onSelect(_hitTest(_toDiagram(d.localPosition)));
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (!_initialized) {
          _fit(constraints.biggest);
          _initialized = true;
        }
        return GestureDetector(
          onScaleStart: _onScaleStart,
          onScaleUpdate: _onScaleUpdate,
          onTapUp: _onTapUp,
          child: CustomPaint(
            size: Size.infinite,
            painter: _DiagramPainter(
              graph: widget.graph,
              scale: _scale,
              offset: _offset,
              selectedKey: widget.selectedKey,
              theme: Theme.of(context),
            ),
          ),
        );
      },
    );
  }
}

class _DiagramPainter extends CustomPainter {
  _DiagramPainter({
    required this.graph,
    required this.scale,
    required this.offset,
    required this.selectedKey,
    required this.theme,
  });

  final DiagramGraph graph;
  final double scale;
  final Offset offset;
  final String? selectedKey;
  final ThemeData theme;

  @override
  void paint(Canvas canvas, Size size) {
    final scheme = theme.colorScheme;
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = theme.scaffoldBackgroundColor,
    );

    canvas.save();
    canvas.translate(offset.dx, offset.dy);
    canvas.scale(scale);

    _paintGrid(canvas, size, scheme);
    final nodes = graph.nodesByKey;
    for (final link in graph.links) {
      _paintLink(canvas, link, nodes, scheme);
    }
    for (final node in graph.nodes) {
      _paintNode(canvas, node, node.key == selectedKey, scheme);
    }
    canvas.restore();
  }

  void _paintGrid(Canvas canvas, Size size, ColorScheme scheme) {
    final bounds = graph.contentBounds().inflate(400);
    final paint = Paint()
      ..color = scheme.outlineVariant.withValues(alpha: 0.25)
      ..strokeWidth = 1 / scale;
    const step = 26.0;
    for (double x = bounds.left - (bounds.left % step);
        x < bounds.right;
        x += step) {
      canvas.drawLine(Offset(x, bounds.top), Offset(x, bounds.bottom), paint);
    }
    for (double y = bounds.top - (bounds.top % step);
        y < bounds.bottom;
        y += step) {
      canvas.drawLine(Offset(bounds.left, y), Offset(bounds.right, y), paint);
    }
  }

  void _paintLink(
    Canvas canvas,
    DiagramLink link,
    Map<String, DiagramNode> nodes,
    ColorScheme scheme,
  ) {
    final a = nodes[link.from];
    final b = nodes[link.to];
    if (a == null || b == null) return;

    final path = Path();
    if (link.points.length >= 2) {
      path.moveTo(link.points.first.dx, link.points.first.dy);
      for (final p in link.points.skip(1)) {
        path.lineTo(p.dx, p.dy);
      }
    } else {
      // Orthogonal (clean right-angle) route between the two node centers,
      // matching the web editor's link routing.
      final start = a.bounds.center;
      final end = b.bounds.center;
      final midX = (start.dx + end.dx) / 2;
      path.moveTo(start.dx, start.dy);
      path.lineTo(midX, start.dy);
      path.lineTo(midX, end.dy);
      path.lineTo(end.dx, end.dy);
    }

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = (link.isWire ? 1.6 : 2.0)
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = link.isWire ? scheme.primary : scheme.onSurfaceVariant;
    canvas.drawPath(path, paint);
  }

  void _paintNode(
    Canvas canvas,
    DiagramNode node,
    bool selected,
    ColorScheme scheme,
  ) {
    final rect = node.bounds;

    // Electrical symbols render as schematic art, not a card.
    final symbol = symbolFor(node.shape);
    if (symbol != null) {
      paintSymbol(canvas, rect, symbol, scheme.onSurface);
      if (selected) {
        canvas.drawRect(
          rect.inflate(4),
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.6
            ..color = scheme.primary,
        );
      }
      if (node.text.isNotEmpty) {
        final tp = TextPainter(
          text: TextSpan(
            text: node.text,
            style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(rect.left, rect.bottom + 2));
      }
      _paintPartBadge(canvas, node, rect, scheme);
      return;
    }

    final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(10));

    canvas.drawRRect(
      rrect,
      Paint()..color = (node.color ?? scheme.surface),
    );
    canvas.drawRRect(
      rrect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = selected ? 2.5 : 1.4
        ..color = selected ? scheme.primary : scheme.outlineVariant,
    );

    if (node.text.isNotEmpty) {
      final tp = TextPainter(
        text: TextSpan(
          text: node.text,
          style: TextStyle(
            color: _readableOn(node.color ?? scheme.surface),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
        maxLines: 3,
        ellipsis: '…',
      )..layout(maxWidth: rect.width - 12);
      tp.paint(
        canvas,
        Offset(
          rect.left + (rect.width - tp.width) / 2,
          rect.top + (rect.height - tp.height) / 2,
        ),
      );
    }
    _paintPartBadge(canvas, node, rect, scheme);
  }

  /// A small amber "link + count" badge at the node's top-right when it has
  /// attached catalogue parts.
  void _paintPartBadge(
    Canvas canvas,
    DiagramNode node,
    Rect rect,
    ColorScheme scheme,
  ) {
    final count = node.attachedPartsCount;
    if (count == 0) return;
    const r = 9.0;
    final center = Offset(rect.right, rect.top);
    canvas.drawCircle(center, r, Paint()..color = const Color(0xFFF5A623));
    canvas.drawCircle(
      center,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = scheme.surface,
    );
    final tp = TextPainter(
      text: TextSpan(
        text: '$count',
        style: const TextStyle(
          color: Color(0xFF1A1303),
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
  }

  Color _readableOn(Color background) {
    return background.computeLuminance() > 0.5 ? Colors.black87 : Colors.white;
  }

  @override
  bool shouldRepaint(covariant _DiagramPainter old) {
    return old.graph != graph ||
        old.scale != scale ||
        old.offset != offset ||
        old.selectedKey != selectedKey ||
        old.theme != theme;
  }
}

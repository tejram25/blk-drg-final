import 'package:flutter/material.dart';
import 'package:path_drawing/path_drawing.dart';

import '../domain/electrical_symbols.g.dart';
import '../domain/symbol_def.dart';

/// Draws an electrical [SymbolDef] into [rect], scaling from the symbol's local
/// coordinate space, in [color]. This is the mobile equivalent of the web
/// editor's SVG symbol rendering — the `d` path strings are shared verbatim
/// (generated from the same source), so a symbol looks identical on both.
void paintSymbol(Canvas canvas, Rect rect, SymbolDef def, Color color) {
  if (def.width <= 0 || def.height <= 0) return;
  final sx = rect.width / def.width;
  final sy = rect.height / def.height;
  final strokeScale = (sx + sy) / 2;

  canvas.save();
  canvas.translate(rect.left, rect.top);
  canvas.scale(sx, sy);

  final stroke = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1.6 / strokeScale
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..color = color;
  final fill = Paint()
    ..style = PaintingStyle.fill
    ..color = color;

  for (final p in def.paths) {
    final path = _tryParse(p.d);
    if (path == null) continue;
    canvas.drawPath(path, p.fill ? fill : stroke);
  }

  for (final t in def.texts) {
    _paintText(canvas, t, color, strokeScale);
  }
  canvas.restore();
}

/// The symbol for a shape id, or null if it isn't an electrical symbol.
SymbolDef? symbolFor(String? shape) =>
    shape == null ? null : kElectricalSymbols[shape];

Path? _tryParse(String d) {
  try {
    return parseSvgPathData(d);
  } catch (_) {
    return null;
  }
}

void _paintText(Canvas canvas, SymbolText t, Color color, double strokeScale) {
  final tp = TextPainter(
    text: TextSpan(
      text: t.text,
      style: TextStyle(
        color: color,
        fontSize: t.size,
        fontWeight: t.bold ? FontWeight.w700 : FontWeight.w400,
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();

  // SVG text anchors horizontally; approximate the baseline with a small lift.
  final dx = switch (t.anchor) {
    'start' => 0.0,
    'end' => -tp.width,
    _ => -tp.width / 2,
  };
  tp.paint(canvas, Offset(t.x + dx, t.y - tp.height * 0.8));
}

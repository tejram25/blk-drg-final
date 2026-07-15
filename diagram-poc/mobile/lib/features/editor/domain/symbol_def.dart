import 'dart:ui';

/// One stroked (or filled) SVG sub-path of an electrical symbol.
class SymbolPath {
  const SymbolPath(this.d, {this.fill = false});

  /// SVG path data in the symbol's local coordinate space.
  final String d;

  /// When true the path is filled with the stroke color (e.g. a diode triangle).
  final bool fill;
}

/// A static label drawn inside a symbol (e.g. an IC pin name).
class SymbolText {
  const SymbolText(
    this.x,
    this.y,
    this.text, {
    this.size = 8,
    this.bold = false,
    this.anchor = 'middle',
  });

  final double x;
  final double y;
  final String text;
  final double size;
  final bool bold;
  final String anchor; // 'start' | 'middle' | 'end'
}

/// A schematic symbol: vector paths + labels + connection pins, defined in a
/// fixed local coordinate space of [width] x [height].
class SymbolDef {
  const SymbolDef({
    required this.width,
    required this.height,
    required this.paths,
    required this.pins,
    this.texts = const [],
  });

  final double width;
  final double height;
  final List<SymbolPath> paths;
  final List<SymbolText> texts;
  final List<Offset> pins;
}

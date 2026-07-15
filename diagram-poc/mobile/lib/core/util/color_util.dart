import 'dart:ui';

/// Parse a CSS-style hex color ("#rgb", "#rrggbb", "#aarrggbb") into a [Color].
/// Returns null for anything that isn't a valid hex string.
Color? parseHexColor(Object? v) {
  if (v is! String || v.isEmpty) return null;
  var hex = v.trim();
  if (!hex.startsWith('#')) return null;
  hex = hex.substring(1);
  if (hex.length == 3) {
    hex = hex.split('').map((c) => '$c$c').join();
  }
  if (hex.length == 6) hex = 'FF$hex';
  if (hex.length != 8) return null;
  final value = int.tryParse(hex, radix: 16);
  return value == null ? null : Color(value);
}

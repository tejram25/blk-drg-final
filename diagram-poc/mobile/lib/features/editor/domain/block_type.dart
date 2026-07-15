import 'dart:ui';

import '../../../core/util/color_util.dart';

/// A palette entry from `GET /api/block-types`: a functional block, a basic
/// shape, or (client-side) an electrical symbol.
class BlockType {
  const BlockType({
    required this.key,
    required this.label,
    required this.category,
    required this.colorHex,
    this.icon,
    this.shape,
  });

  final String key;
  final String label;
  final String category;
  final String colorHex;

  /// Material icon name for functional blocks (e.g. "sensors").
  final String? icon;

  /// Shape id for basic shapes ("basic-rectangle") or symbols ("elec-npn").
  final String? shape;

  Color? get color => parseHexColor(colorHex);

  bool get isSymbol => (shape ?? '').startsWith('elec-');
  bool get isShape => (shape ?? '').startsWith('basic-');

  factory BlockType.fromJson(Map<String, dynamic> json) {
    return BlockType(
      key: (json['key'] ?? '') as String,
      label: (json['label'] ?? '') as String,
      category: (json['category'] ?? 'Blocks') as String,
      colorHex: (json['color'] ?? '#1d4ed8') as String,
      icon: json['icon'] as String?,
      shape: json['shape'] as String?,
    );
  }
}

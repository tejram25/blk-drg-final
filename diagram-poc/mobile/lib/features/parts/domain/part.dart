/// A catalogue part flattened from the Arrow-shaped `/api/parts/search`
/// response (the same fields the web client extracts).
class Part {
  const Part({
    required this.partNumber,
    required this.manufacturer,
    required this.supplier,
    required this.description,
  });

  final String partNumber;
  final String manufacturer;
  final String supplier;
  final String description;

  /// Read a nested `{ name: "..." }` object's name.
  static String _name(Object? node) {
    if (node is Map && node['name'] is String) return node['name'] as String;
    return '';
  }

  /// Map one entry of `partserviceresult.parts[]`.
  factory Part.fromArrow(Map<String, dynamic> p) {
    final orgs = p['invOrgs'];
    final org = (orgs is List && orgs.isNotEmpty && orgs.first is Map)
        ? Map<String, dynamic>.from(orgs.first as Map)
        : const <String, dynamic>{};
    final partNumber = _name(p['arwPartNum']).isNotEmpty
        ? _name(p['arwPartNum'])
        : _name(p['suppPartNum']).isNotEmpty
            ? _name(p['suppPartNum'])
            : (p['partKey']?.toString() ?? 'Unknown');
    final description = (org['desc'] as String?)?.isNotEmpty == true
        ? org['desc'] as String
        : _name(p['icc']);
    return Part(
      partNumber: partNumber,
      manufacturer: _name(p['mfr']),
      supplier: _name(p['supp']),
      description: description,
    );
  }

  /// Stored on a node under `attachedParts` in the shape the web editor uses:
  /// `{ part: {...}, quantity: n }`.
  Map<String, dynamic> toJson() => {
        'partNumber': partNumber,
        'manufacturer': manufacturer,
        'supplier': supplier,
        'partDesc': description,
      };

  factory Part.fromJson(Map<String, dynamic> json) => Part(
        partNumber: (json['partNumber'] ?? '') as String,
        manufacturer: (json['manufacturer'] ?? '') as String,
        supplier: (json['supplier'] ?? '') as String,
        description: (json['partDesc'] ?? json['description'] ?? '') as String,
      );
}

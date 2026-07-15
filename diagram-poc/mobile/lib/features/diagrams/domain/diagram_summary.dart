/// A row in the diagram list (`GET /api/diagrams`).
class DiagramSummary {
  const DiagramSummary({
    required this.id,
    required this.name,
    required this.classification,
    required this.ownerEmail,
    required this.updatedAt,
  });

  final int id;
  final String name;
  final String classification;
  final String ownerEmail;
  final DateTime? updatedAt;

  factory DiagramSummary.fromJson(Map<String, dynamic> json) {
    return DiagramSummary(
      id: (json['id'] as num).toInt(),
      name: (json['name'] ?? 'Untitled diagram') as String,
      classification: (json['classification'] ?? 'INTERNAL') as String,
      ownerEmail: (json['ownerEmail'] ?? '') as String,
      updatedAt: DateTime.tryParse('${json['updatedAt']}')?.toLocal(),
    );
  }
}

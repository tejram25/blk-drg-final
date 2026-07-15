/// A full diagram (`GET /api/diagrams/{id}`). [contentJson] is the serialized
/// GoJS GraphLinksModel produced by the web editor; the mobile canvas parses it
/// into a [DiagramGraph] for rendering.
class DiagramDetail {
  const DiagramDetail({
    required this.id,
    required this.name,
    required this.contentJson,
    required this.classification,
    required this.ownerEmail,
    required this.updatedAt,
  });

  final int id;
  final String name;
  final String contentJson;
  final String classification;
  final String ownerEmail;
  final DateTime? updatedAt;

  factory DiagramDetail.fromJson(Map<String, dynamic> json) {
    return DiagramDetail(
      id: (json['id'] as num).toInt(),
      name: (json['name'] ?? 'Untitled diagram') as String,
      contentJson: (json['contentJson'] ?? '') as String,
      classification: (json['classification'] ?? 'INTERNAL') as String,
      ownerEmail: (json['ownerEmail'] ?? '') as String,
      updatedAt: DateTime.tryParse('${json['updatedAt']}')?.toLocal(),
    );
  }
}

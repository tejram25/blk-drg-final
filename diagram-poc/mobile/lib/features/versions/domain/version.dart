/// A saved snapshot of a diagram (`/api/diagrams/{id}/versions`).
class VersionSummary {
  const VersionSummary({
    required this.id,
    required this.label,
    required this.authorName,
    required this.createdAt,
  });

  final int id;
  final String label;
  final String authorName;
  final DateTime? createdAt;

  factory VersionSummary.fromJson(Map<String, dynamic> json) {
    return VersionSummary(
      id: (json['id'] as num).toInt(),
      label: (json['label'] ?? '') as String,
      authorName: (json['authorName'] ?? '') as String,
      createdAt: DateTime.tryParse('${json['createdAt']}')?.toLocal(),
    );
  }
}

/// A version with its full content, for viewing or restoring.
class VersionDetail {
  const VersionDetail({
    required this.id,
    required this.label,
    required this.contentJson,
    required this.authorName,
    required this.createdAt,
  });

  final int id;
  final String label;
  final String contentJson;
  final String authorName;
  final DateTime? createdAt;

  factory VersionDetail.fromJson(Map<String, dynamic> json) {
    return VersionDetail(
      id: (json['id'] as num).toInt(),
      label: (json['label'] ?? '') as String,
      contentJson: (json['contentJson'] ?? '') as String,
      authorName: (json['authorName'] ?? '') as String,
      createdAt: DateTime.tryParse('${json['createdAt']}')?.toLocal(),
    );
  }
}

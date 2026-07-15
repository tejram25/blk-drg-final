/// A comment on a diagram (`/api/diagrams/{id}/comments`).
class Comment {
  const Comment({
    required this.id,
    required this.nodeId,
    required this.authorName,
    required this.text,
    required this.createdAt,
    required this.self,
  });

  final int id;
  final String? nodeId;
  final String authorName;
  final String text;
  final DateTime? createdAt;

  /// True when the current user authored it (so the UI can offer delete).
  final bool self;

  factory Comment.fromJson(Map<String, dynamic> json) {
    return Comment(
      id: (json['id'] as num).toInt(),
      nodeId: json['nodeId'] as String?,
      authorName: (json['authorName'] ?? '') as String,
      text: (json['text'] ?? '') as String,
      createdAt: DateTime.tryParse('${json['createdAt']}')?.toLocal(),
      self: json['self'] == true,
    );
  }
}

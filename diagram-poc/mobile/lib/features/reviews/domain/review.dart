/// One user's review of a diagram.
class ReviewItem {
  const ReviewItem({
    required this.userName,
    required this.rating,
    required this.comment,
    required this.updatedAt,
    required this.self,
  });

  final String userName;
  final int rating;
  final String comment;
  final DateTime? updatedAt;
  final bool self;

  factory ReviewItem.fromJson(Map<String, dynamic> json) {
    return ReviewItem(
      userName: (json['userName'] ?? '') as String,
      rating: (json['rating'] as num?)?.toInt() ?? 0,
      comment: (json['comment'] ?? '') as String,
      updatedAt: DateTime.tryParse('${json['updatedAt']}')?.toLocal(),
      self: json['self'] == true,
    );
  }
}

/// Aggregate reviews for a diagram, plus the current user's own review.
class ReviewSummary {
  const ReviewSummary({
    required this.average,
    required this.count,
    required this.distribution,
    required this.myRating,
    required this.myComment,
    required this.reviews,
  });

  final double average;
  final int count;
  final Map<int, int> distribution; // stars (1..5) -> how many
  final int myRating; // 0 = not yet rated
  final String myComment;
  final List<ReviewItem> reviews;

  factory ReviewSummary.fromJson(Map<String, dynamic> json) {
    final dist = <int, int>{};
    final rawDist = json['distribution'];
    if (rawDist is Map) {
      rawDist.forEach((k, v) {
        final star = int.tryParse('$k');
        if (star != null) dist[star] = (v as num?)?.toInt() ?? 0;
      });
    }
    final mine = json['mine'];
    final items = json['reviews'];
    return ReviewSummary(
      average: (json['average'] as num?)?.toDouble() ?? 0,
      count: (json['count'] as num?)?.toInt() ?? 0,
      distribution: dist,
      myRating: (mine is Map ? (mine['rating'] as num?)?.toInt() : 0) ?? 0,
      myComment: (mine is Map ? mine['comment'] as String? : null) ?? '',
      reviews: (items is List)
          ? items
              .whereType<Map>()
              .map((e) => ReviewItem.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/providers.dart';
import '../../../core/network/api_client.dart';
import '../domain/review.dart';

/// Diagram reviews + ratings (`/api/diagrams/{id}/reviews`).
class ReviewRepository {
  ReviewRepository(this._api);

  final ApiClient _api;

  Future<ReviewSummary> get(int diagramId) async {
    final res = await _api.getJson<Map<String, dynamic>>('/diagrams/$diagramId/reviews');
    return ReviewSummary.fromJson(res.data ?? const {});
  }

  Future<ReviewSummary> submit(int diagramId, int rating, String comment) async {
    final res = await _api.postJson<Map<String, dynamic>>(
      '/diagrams/$diagramId/reviews',
      body: {'rating': rating, 'comment': comment},
    );
    return ReviewSummary.fromJson(res.data ?? const {});
  }
}

final reviewRepositoryProvider = Provider<ReviewRepository>((ref) {
  return ReviewRepository(ref.watch(apiClientProvider));
});

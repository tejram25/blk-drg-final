import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/providers.dart';
import '../../../core/network/api_client.dart';
import '../domain/comment.dart';

/// CRUD for diagram comments.
class CommentRepository {
  CommentRepository(this._api);

  final ApiClient _api;

  Future<List<Comment>> list(int diagramId) async {
    final res = await _api.getJson<List<dynamic>>('/diagrams/$diagramId/comments');
    return (res.data ?? const [])
        .whereType<Map>()
        .map((e) => Comment.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Comment> add(int diagramId, String text, {String? nodeId}) async {
    final res = await _api.postJson<Map<String, dynamic>>(
      '/diagrams/$diagramId/comments',
      body: {'text': text, 'nodeId': ?nodeId},
    );
    return Comment.fromJson(res.data ?? const {});
  }

  Future<void> delete(int commentId) =>
      _api.deleteJson<void>('/comments/$commentId');
}

final commentRepositoryProvider = Provider<CommentRepository>((ref) {
  return CommentRepository(ref.watch(apiClientProvider));
});

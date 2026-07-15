import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/comment_repository.dart';
import '../domain/comment.dart';

/// The comment thread for a diagram, provider-family keyed by diagram id.
final commentsProvider =
    FutureProvider.family<List<Comment>, int>((ref, diagramId) {
  return ref.watch(commentRepositoryProvider).list(diagramId);
});

class CommentsSheet extends ConsumerStatefulWidget {
  const CommentsSheet({super.key, required this.diagramId});

  final int diagramId;

  static Future<void> show(BuildContext context, int diagramId) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => CommentsSheet(diagramId: diagramId),
    );
  }

  @override
  ConsumerState<CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends ConsumerState<CommentsSheet> {
  final _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(commentRepositoryProvider).add(widget.diagramId, text);
      _controller.clear();
      ref.invalidate(commentsProvider(widget.diagramId));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _delete(Comment c) async {
    await ref.read(commentRepositoryProvider).delete(c.id);
    ref.invalidate(commentsProvider(widget.diagramId));
  }

  @override
  Widget build(BuildContext context) {
    final comments = ref.watch(commentsProvider(widget.diagramId));
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        builder: (context, scrollController) {
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Row(
                  children: [
                    const Icon(Icons.forum_outlined, size: 20),
                    const SizedBox(width: 8),
                    Text('Comments',
                        style: Theme.of(context).textTheme.titleMedium),
                  ],
                ),
              ),
              Expanded(
                child: comments.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('$e')),
                  data: (items) => items.isEmpty
                      ? const Center(child: Text('No comments yet.'))
                      : ListView.separated(
                          controller: scrollController,
                          itemCount: items.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (context, i) =>
                              _CommentTile(comment: items[i], onDelete: _delete),
                        ),
                ),
              ),
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        minLines: 1,
                        maxLines: 4,
                        textInputAction: TextInputAction.send,
                        decoration:
                            const InputDecoration(hintText: 'Add a comment…'),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      onPressed: _sending ? null : _send,
                      icon: _sending
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({required this.comment, required this.onDelete});

  final Comment comment;
  final Future<void> Function(Comment) onDelete;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(comment.authorName),
      subtitle: Text(comment.text),
      trailing: comment.self
          ? IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: () => onDelete(comment),
            )
          : null,
    );
  }
}

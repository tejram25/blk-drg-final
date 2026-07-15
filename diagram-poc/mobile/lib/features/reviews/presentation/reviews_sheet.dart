import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/star_rating.dart';
import '../data/review_repository.dart';
import '../domain/review.dart';

final reviewsProvider =
    FutureProvider.family<ReviewSummary, int>((ref, diagramId) {
  return ref.watch(reviewRepositoryProvider).get(diagramId);
});

class ReviewsSheet extends ConsumerStatefulWidget {
  const ReviewsSheet({super.key, required this.diagramId});

  final int diagramId;

  static Future<void> show(BuildContext context, int diagramId) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ReviewsSheet(diagramId: diagramId),
    );
  }

  @override
  ConsumerState<ReviewsSheet> createState() => _ReviewsSheetState();
}

class _ReviewsSheetState extends ConsumerState<ReviewsSheet> {
  final _comment = TextEditingController();
  int _myRating = 0;
  bool _submitting = false;
  bool _initialized = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_myRating == 0 || _submitting) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(reviewRepositoryProvider)
          .submit(widget.diagramId, _myRating, _comment.text.trim());
      ref.invalidate(reviewsProvider(widget.diagramId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Review submitted')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = ref.watch(reviewsProvider(widget.diagramId));
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.75,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        builder: (context, scrollController) {
          return summary.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('$e')),
            data: (data) {
              if (!_initialized) {
                _myRating = data.myRating;
                _comment.text = data.myComment;
                _initialized = true;
              }
              return ListView(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                children: [
                  _Header(average: data.average, count: data.count),
                  const SizedBox(height: 16),
                  Text('Your rating',
                      style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  StarRating(
                    rating: _myRating.toDouble(),
                    size: 34,
                    onChanged: (r) => setState(() => _myRating = r),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _comment,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      hintText: 'Add a comment (optional)…',
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed:
                        (_myRating == 0 || _submitting) ? null : _submit,
                    child: _submitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(data.myRating > 0
                            ? 'Update review'
                            : 'Submit review'),
                  ),
                  const Divider(height: 32),
                  Text('All reviews (${data.count})',
                      style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  if (data.reviews.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Text('No reviews yet.'),
                    )
                  else
                    for (final r in data.reviews) _ReviewRow(item: r),
                ],
              );
            },
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.average, required this.count});

  final double average;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(average.toStringAsFixed(1),
            style: Theme.of(context).textTheme.displaySmall),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            StarRating(rating: average, size: 20),
            Text('$count review${count == 1 ? '' : 's'}',
                style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ],
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.item});

  final ReviewItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(item.self ? '${item.userName} (you)' : item.userName,
                  style: Theme.of(context).textTheme.labelLarge),
              const Spacer(),
              StarRating(rating: item.rating.toDouble(), size: 14),
            ],
          ),
          if (item.comment.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(item.comment),
            ),
        ],
      ),
    );
  }
}

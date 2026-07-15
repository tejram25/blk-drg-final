import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/part_repository.dart';
import '../domain/part.dart';

/// Bottom sheet for searching the parts catalogue. Returns the chosen [Part].
class PartSearchSheet extends ConsumerStatefulWidget {
  const PartSearchSheet({super.key});

  static Future<Part?> show(BuildContext context) {
    return showModalBottomSheet<Part>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const PartSearchSheet(),
    );
  }

  @override
  ConsumerState<PartSearchSheet> createState() => _PartSearchSheetState();
}

class _PartSearchSheetState extends ConsumerState<PartSearchSheet> {
  final _controller = TextEditingController();
  Timer? _debounce;
  bool _loading = false;
  String? _error;
  List<Part> _results = const [];

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => _search(value));
  }

  Future<void> _search(String query) async {
    if (query.trim().isEmpty) {
      setState(() {
        _results = const [];
        _error = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final hits = await ref.read(partRepositoryProvider).search(query);
      if (mounted) setState(() => _results = hits);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Search parts (MPN, keyword)…',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _loading
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : null,
                  ),
                  onChanged: _onChanged,
                  onSubmitted: _search,
                ),
              ),
              Expanded(child: _body(scrollController)),
            ],
          );
        },
      ),
    );
  }

  Widget _body(ScrollController controller) {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(_error!, textAlign: TextAlign.center),
        ),
      );
    }
    if (_results.isEmpty) {
      return Center(
        child: Text(
          _controller.text.trim().isEmpty
              ? 'Type to search the catalogue.'
              : (_loading ? 'Searching…' : 'No matches.'),
        ),
      );
    }
    return ListView.separated(
      controller: controller,
      itemCount: _results.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final part = _results[i];
        return ListTile(
          title: Text(part.partNumber),
          subtitle: Text(
            [part.manufacturer, part.description]
                .where((s) => s.isNotEmpty)
                .join(' · '),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: const Icon(Icons.add_link),
          onTap: () => Navigator.pop(context, part),
        );
      },
    );
  }
}

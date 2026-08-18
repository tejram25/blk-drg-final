import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../../theme';
import StarRating from '../../ui/StarRating';
import { Sheet } from './CommentsModal';
import { reviewsApi } from './reviewsApi';

export default function ReviewsModal({
  visible,
  onClose,
  diagramId,
}: {
  visible: boolean;
  onClose: () => void;
  diagramId: number;
}) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [seeded, setSeeded] = useState(false);

  const q = useQuery({
    queryKey: ['reviews', diagramId],
    queryFn: () => reviewsApi.get(diagramId),
    enabled: visible,
  });

  useEffect(() => {
    if (q.data && !seeded) {
      setRating(q.data.myRating);
      setComment(q.data.myComment);
      setSeeded(true);
    }
  }, [q.data, seeded]);
  useEffect(() => {
    if (!visible) setSeeded(false);
  }, [visible]);

  const submit = useMutation({
    mutationFn: () => reviewsApi.submit(diagramId, rating, comment.trim()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews', diagramId] }),
  });

  return (
    <Sheet visible={visible} onClose={onClose} title="Reviews & ratings">
      {q.isLoading || !q.data ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView>
          <View style={styles.summary}>
            <Text style={styles.avg}>{q.data.average.toFixed(1)}</Text>
            <View>
              <StarRating rating={q.data.average} />
              <Text style={styles.count}>
                {q.data.count} review{q.data.count === 1 ? '' : 's'}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Your rating</Text>
          <StarRating rating={rating} size={34} onChange={setRating} />
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment (optional)…"
            placeholderTextColor={colors.subtext}
            style={styles.input}
            multiline
          />
          <Pressable
            style={[styles.submit, { opacity: rating === 0 || submit.isPending ? 0.5 : 1 }]}
            disabled={rating === 0 || submit.isPending}
            onPress={() => submit.mutate()}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {q.data.myRating > 0 ? 'Update review' : 'Submit review'}
            </Text>
          </Pressable>

          <Text style={[styles.label, { marginTop: 20 }]}>All reviews</Text>
          {q.data.reviews.length === 0 ? (
            <Text style={styles.empty}>No reviews yet.</Text>
          ) : (
            q.data.reviews.map((r, i) => (
              <View key={i} style={styles.reviewRow}>
                <View style={styles.reviewHead}>
                  <Text style={styles.reviewer}>{r.self ? `${r.userName} (you)` : r.userName}</Text>
                  <StarRating rating={r.rating} size={14} />
                </View>
                {r.comment ? <Text style={styles.reviewText}>{r.comment}</Text> : null}
              </View>
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avg: { fontSize: 40, fontWeight: '800', color: colors.text },
  count: { color: colors.subtext, fontSize: 12 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 10, minHeight: 60, marginTop: 8, color: colors.text },
  submit: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  empty: { color: colors.subtext, paddingVertical: 8 },
  reviewRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewer: { fontWeight: '600', color: colors.text },
  reviewText: { color: colors.text, marginTop: 2 },
});

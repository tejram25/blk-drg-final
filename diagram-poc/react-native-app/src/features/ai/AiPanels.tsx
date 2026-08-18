import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme';
import { Sheet } from '../collab/CommentsModal';
import { aiApi, AlternativePart, ReviewBlock, ReviewLink } from './aiApi';

const SEV_COLOR: Record<string, string> = { risk: '#b91c1c', warn: '#b45309', info: '#1d4ed8' };
const TYPE_ICON: Record<string, string> = { template: '📐', part: '🔩', solution: '💡' };

function AiNote({ model, aiGenerated, note }: { model?: string; aiGenerated?: boolean; note?: string }) {
  return (
    <Text style={styles.note}>
      {aiGenerated ? `✨ ${model || 'AI'}` : '⚙︎ rule-based'}
      {note ? ` · ${note}` : ''}
    </Text>
  );
}

export function RecommendationsModal({
  visible,
  onClose,
  goal,
  currentParts,
  onAddPart,
}: {
  visible: boolean;
  onClose: () => void;
  goal: string;
  currentParts: string[];
  onAddPart: (query: string) => void;
}) {
  const q = useQuery({
    queryKey: ['recommendations', goal, currentParts.join(',')],
    queryFn: () => aiApi.recommend(goal, currentParts),
    enabled: visible,
  });
  return (
    <Sheet visible={visible} onClose={onClose} title="Recommendations">
      {q.isLoading ? (
        <Loading label="Thinking about your design…" />
      ) : q.isError ? (
        <ErrText err={q.error} />
      ) : (
        <ScrollView>
          <AiNote model={q.data?.model} aiGenerated={q.data?.aiGenerated} note={q.data?.note} />
          {(q.data?.items ?? []).length === 0 ? (
            <Text style={styles.empty}>No recommendations right now.</Text>
          ) : (
            (q.data?.items ?? []).map((it, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>
                    {(TYPE_ICON[it.type] ?? '•') + '  ' + it.title}
                  </Text>
                  <Text style={styles.badge}>{it.type}</Text>
                </View>
                <Text style={styles.detail}>{it.detail}</Text>
                {it.source ? <Text style={styles.meta}>Source: {it.source}</Text> : null}
                {it.verify ? <Text style={styles.meta}>Verify: {it.verify}</Text> : null}
                {it.type === 'part' ? (
                  <Pressable style={styles.action} onPress={() => onAddPart(it.query?.trim() || it.title)}>
                    <Text style={styles.actionText}>Find in catalogue →</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </Sheet>
  );
}

export function DesignReviewModal({
  visible,
  onClose,
  goal,
  blocks,
  links,
}: {
  visible: boolean;
  onClose: () => void;
  goal: string;
  blocks: ReviewBlock[];
  links: ReviewLink[];
}) {
  const q = useQuery({
    queryKey: ['design-review', goal, JSON.stringify(blocks), JSON.stringify(links)],
    queryFn: () => aiApi.designReview(goal, blocks, links),
    enabled: visible && blocks.length > 0,
  });
  return (
    <Sheet visible={visible} onClose={onClose} title="Design review">
      {blocks.length === 0 ? (
        <Text style={styles.empty}>Add some blocks to the canvas first, then run a review.</Text>
      ) : q.isLoading ? (
        <Loading label="Reviewing your block diagram…" />
      ) : q.isError ? (
        <ErrText err={q.error} />
      ) : (
        <ScrollView>
          <AiNote model={q.data?.model} aiGenerated={q.data?.aiGenerated} note={q.data?.note} />
          {(q.data?.findings ?? []).length === 0 ? (
            <Text style={styles.empty}>No issues found. 👍</Text>
          ) : (
            (q.data?.findings ?? []).map((f, i) => (
              <View key={i} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: SEV_COLOR[f.severity] ?? colors.border }]}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{f.title}</Text>
                  <Text style={[styles.sevBadge, { backgroundColor: SEV_COLOR[f.severity] ?? colors.subtext }]}>
                    {f.severity}
                  </Text>
                </View>
                <Text style={styles.meta}>{f.category}</Text>
                <Text style={styles.detail}>{f.detail}</Text>
                {f.suggestion ? <Text style={styles.suggest}>💡 {f.suggestion}</Text> : null}
              </View>
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </Sheet>
  );
}

export function LifecycleModal({
  visible,
  onClose,
  partNumber,
  onAddAlternative,
}: {
  visible: boolean;
  onClose: () => void;
  partNumber: string | null;
  onAddAlternative: (alt: AlternativePart) => void;
}) {
  const q = useQuery({
    queryKey: ['lifecycle', partNumber],
    queryFn: () => aiApi.lifecycle(partNumber as string),
    enabled: visible && !!partNumber,
  });
  const riskColor = q.data?.risk === 'high' ? '#b91c1c' : q.data?.risk === 'medium' ? '#b45309' : '#15803d';
  return (
    <Sheet visible={visible} onClose={onClose} title="Part lifecycle">
      {!partNumber ? (
        <Text style={styles.empty}>Select a part card or a block with an attached part first.</Text>
      ) : q.isLoading ? (
        <Loading label={`Checking ${partNumber}…`} />
      ) : q.isError ? (
        <ErrText err={q.error} />
      ) : q.data ? (
        <ScrollView>
          <Text style={styles.pn}>{q.data.partNumber}</Text>
          <View style={styles.statusRow}>
            <Text style={[styles.statusPill, { backgroundColor: riskColor }]}>{q.data.status}</Text>
            <Text style={styles.meta}>risk: {q.data.risk}</Text>
          </View>
          <Text style={styles.detail}>{q.data.recommendation}</Text>
          {q.data.alternatives.length > 0 ? (
            <>
              <Text style={styles.section}>Alternatives</Text>
              {q.data.alternatives.map((a, i) => (
                <View key={i} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{a.partNumber}</Text>
                    {a.dropIn ? <Text style={styles.dropIn}>drop-in</Text> : null}
                  </View>
                  <Text style={styles.meta}>{a.manufacturer}</Text>
                  <Text style={styles.detail}>{a.note}</Text>
                  <Pressable style={styles.action} onPress={() => onAddAlternative(a)}>
                    <Text style={styles.actionText}>Add to canvas →</Text>
                  </Pressable>
                </View>
              ))}
            </>
          ) : null}
          <View style={{ height: 24 }} />
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <View style={{ alignItems: 'center', marginTop: 30 }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.meta, { marginTop: 10 }]}>{label}</Text>
    </View>
  );
}
function ErrText({ err }: { err: unknown }) {
  return <Text style={[styles.empty, { color: colors.danger }]}>{(err as Error)?.message ?? 'Failed.'}</Text>;
}

const styles = StyleSheet.create({
  note: { color: colors.subtext, fontSize: 12, marginBottom: 10 },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 24 },
  card: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontWeight: '700', color: colors.text, fontSize: 15 },
  badge: { fontSize: 11, color: colors.subtext, textTransform: 'uppercase', fontWeight: '700' },
  sevBadge: { fontSize: 11, color: '#fff', fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, textTransform: 'uppercase' },
  detail: { color: colors.text, marginTop: 6, lineHeight: 20 },
  meta: { color: colors.subtext, fontSize: 12, marginTop: 4 },
  suggest: { color: colors.success, marginTop: 8, fontWeight: '600' },
  action: { marginTop: 10, alignSelf: 'flex-start' },
  actionText: { color: colors.primary, fontWeight: '700' },
  pn: { fontSize: 20, fontWeight: '800', color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 8 },
  statusPill: { color: '#fff', fontWeight: '800', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 18, marginBottom: 8 },
  dropIn: { fontSize: 11, color: '#15803d', fontWeight: '800' },
});
